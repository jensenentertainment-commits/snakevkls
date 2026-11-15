// Fixed, disposable local target. Never loads application environment files.
// Candidate RPC body runs in pg_temp; production schemas/RPCs are not replaced.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const bin = 'C:/Users/jense/AppData/Local/SnakeViperValidation/tools/pgsql/bin/psql.exe';
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith('PG')));
Object.assign(env, { PGHOST: '127.0.0.1', PGPORT: '55433', PGUSER: 'snake_catalog_test',
  PGDATABASE: 'snake_phase2a_test_catalogfresh', PGPASSFILE: 'C:/Users/jense/AppData/Local/SnakeCatalogValidation/pgpass.conf',
  PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5',
  PGOPTIONS: '-c snake.phase2a_isolated=on -c statement_timeout=20000 -c lock_timeout=10000' });
if (process.argv.length !== 3 || process.argv[2] !== '--run') throw Error('Use --run; fixed approved local target only');
const guard = readFileSync('tests/database/roy-phase-2a-acceptance.guard.sql', 'utf8');
const migration = readFileSync('supabase/migrations/20261115140231_safe_product_placement_retire_cleanup.sql', 'utf8');
const candidate = migration.slice(migration.indexOf('create function public.save_product_placement_v2'), migration.indexOf('revoke all on function public.save_product_placement_v2'))
  .replace('create function public.save_product_placement_v2', 'create function pg_temp.save_product_placement_v2');
assert(candidate.endsWith('\n') && !candidate.includes('revoke') && candidate.includes('end;'));
const run = randomUUID();
const dir = `coverage/warehouse-package-a/concurrency-${run}`;
mkdirSync(dir, { recursive: true });
const manifest = { run, zone: randomUUID(), locations: Array.from({ length: 4 }, () => randomUUID()),
  products: Array.from({ length: 8 }, () => randomUUID()), inventory: Array.from({ length: 8 }, () => randomUUID()),
  migrationSha256: createHash('sha256').update(migration).digest('hex') };
writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));
const results = [];
const q = x => `'${x}'`;
const [l1, l2, l3, empty] = manifest.locations;
const z = manifest.zone, p = manifest.products, i = manifest.inventory;
const sessions = [];
function session(name) {
  const child = spawn(bin, ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
    { env: { ...env, PGAPPNAME: `warehouse-concurrency-${name}-${run}` }, windowsHide: true });
  let pending, output = '', errors = '', seq = 0;
  child.stdout.on('data', data => {
    output += data.toString().replaceAll('\r', '');
    if (pending && output.includes(pending.marker + '\n')) {
      const result = output.slice(0, output.indexOf(pending.marker)).trim();
      output = ''; const resolve = pending.resolve; pending = null; resolve(result);
    }
  });
  child.stderr.on('data', data => { errors += data; });
  child.on('error', error => { if (pending) pending.reject(error); });
  child.on('exit', code => { if (pending) { pending.reject(Error(`${name} exited ${code}: ${errors}`)); pending = null; } });
  const s = { child, pid: null, async sql(sql) {
    assert(!pending, 'One command per session');
    const marker = `DONE_${name}_${++seq}`;
    const promise = new Promise((resolve, reject) => { pending = { marker, resolve, reject }; });
    // Attach immediately so a blocked command failure cannot become unhandled.
    promise.catch(() => {});
    child.stdin.write(sql + '\n\\echo ' + marker + '\n');
    return promise;
  }};
  sessions.push(s); return s;
}
const a = session('a'), b = session('b'), control = session('control');
const stateSQL = `select json_build_object('inventory',(select md5(coalesce(string_agg(row_to_json(t)::text,'' order by id),'')) from public.inventory t),
 'products',(select count(*) from public.products),'locations',(select count(*) from public.locations),'zones',(select count(*) from public.zones),
 'movements',(select count(*) from public.stock_movements),'activity',(select count(*) from public.activity_log),
 'legacy',md5(pg_get_functiondef('public.set_product_location(uuid,uuid,uuid,uuid,integer,uuid,text,text)'::regprocedure)),
 'candidate',to_regprocedure('public.save_product_placement_v2(text,uuid,uuid,uuid,uuid,uuid,integer,timestamptz,integer,uuid,text,text)')::text);`;
const call = (action, product, inventory, to, from, qty = 'null', stamp = 'null', requested = 'null') =>
  `select pg_temp.save_product_placement_v2('${action}',${q(product)},${inventory ? q(inventory) : 'null'},${q(to)},${from ? q(from) : 'null'},${from ? q(z) : 'null'},${qty},${stamp},${requested},null,null,null);`;
function expect(sql, code) {
  return `do $test$ begin begin ${sql.replace(/^select /, 'perform ')} raise exception 'Expected rejection did not occur'; exception when sqlstate '${code}' then null; end; end $test$;`;
}
async function check(label, sql, expected = 't') {
  assert.equal(await control.sql(sql), expected, label); results.push(label); console.log('PASS:', label);
}
async function blocked(s, blocker) {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    if (await control.sql(`select ${blocker.pid}=any(pg_blocking_pids(${s.pid}));`) === 't') return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw Error('Expected database lock wait was not observed');
}
async function barrier() {
  await a.sql(`begin; select id from public.locations where id=${q(l1)} for update nowait;
    select id from public.inventory where location_id=${q(l1)} order by id for update nowait;`);
}
let before;
try {
  for (const s of sessions) {
    await s.sql(guard); s.pid = Number(await s.sql('select pg_backend_pid();'));
    await s.sql(candidate);
  }
  before = await control.sql(stateSQL);
  writeFileSync(`${dir}/before.json`, before);
  await control.sql(`begin;
    insert into public.zones(id,code,name,pick_priority) values(${q(z)},'CT-${run}','Synthetic concurrency',99998);
    insert into public.locations(id,code,zone_id,active,pick_sequence) values ${manifest.locations.map((l,n) => `(${q(l)},'CT-${l}',${q(z)},true,${n+1})`).join(',')};
    insert into public.products(id,product_name,sku) values ${p.map(id => `(${q(id)},'Synthetic concurrency ${run}',null)`).join(',')};
    insert into public.inventory(id,product_id,location_id,zone_id,quantity,is_primary) values
    ${i.slice(0, 5).map((id,n) => `(${q(id)},${q(p[n])},${q(l1)},${q(z)},10,true)`).join(',')},
    (${q(i[5])},${q(p[0])},${q(l3)},${q(z)},4,false),
    (${q(i[6])},${q(p[5])},${q(l2)},${q(z)},6,true);
    commit;`);
  // A1: stock writer first, actual candidate waits, then preserves committed quantity.
  await a.sql(`begin; select public.apply_stock_movement(${q(i[0])},-3,'correction','Synthetic concurrency',10,null,null,null);`);
  let pending = b.sql(call('place', p[0], i[0], l2, l1)); pending.catch(() => {});
  await blocked(b, a); await a.sql('commit;'); await pending;
  await check('A: stock-first move preserves 7 and second row 4', `select (select quantity=7 and location_id=${q(l2)} from public.inventory where id=${q(i[0])}) and (select quantity=4 from public.inventory where id=${q(i[5])});`);
  // A2: placement first; ordinary stock row writer continues with current value.
  await a.sql('begin; ' + call('place', p[1], i[1], l2, l1));
  pending = b.sql(`select public.apply_stock_movement(${q(i[1])},-2,'correction','Synthetic concurrency',10,null,null,null);`); pending.catch(() => {});
  await blocked(b, a); await a.sql('commit;'); await pending;
  await check('A: move-first stock change retained', `select quantity=8 and location_id=${q(l2)} from public.inventory where id=${q(i[1])};`);
  // A3: second move has stale expected location after first commits.
  await a.sql('begin; ' + call('place', p[2], i[2], l2, l1));
  pending = b.sql(expect(call('place', p[2], i[2], l3, l1), '40001')); pending.catch(() => {});
  await blocked(b, a); await a.sql('commit;'); await pending;
  await check('A: concurrent stale move rejected', `select quantity=10 and location_id=${q(l2)} from public.inventory where id=${q(i[2])};`);
  const stamp = await control.sql(`select updated_at from public.inventory where id=${q(i[3])};`);
  await a.sql(`begin; select public.apply_stock_movement(${q(i[3])},-2,'correction','Synthetic concurrency',10,null,null,null);`);
  pending = b.sql(expect(call('quantity', p[3], i[3], l1, l1, '10', q(stamp), '20'), '40001')); pending.catch(() => {});
  await blocked(b, a); await a.sql('commit;'); await pending;
  await check('A: stale explicit quantity rejected after concurrent change', `select quantity=8 from public.inventory where id=${q(i[3])};`);
  const current = await control.sql(`select updated_at from public.inventory where id=${q(i[0])};`);
  await b.sql(call('quantity', p[0], i[0], l2, l2, '7', q(current), '12'));
  await b.sql(expect(call('register', p[0], null, l1, null, 'null', 'null', '99'), '40001'));
  await check('A: explicit count targets one UUID; register refuses multi-row product', `select count(*)=2 and sum(quantity)=16 from public.inventory where product_id=${q(p[0])};`);
  await a.sql('begin; ' + call('register', p[6], null, l1, null, 'null', 'null', '5'));
  pending = b.sql(expect(call('register', p[6], null, l2, null, 'null', 'null', '9'), '40001')); pending.catch(() => {});
  await blocked(b, a); await a.sql('commit;'); await pending;
  await check('A: concurrent first registration creates one row only', `select count(*)=1 and sum(quantity)=5 from public.inventory where product_id=${q(p[6])};`);
  await b.sql(`select public.add_product_to_location(${q(p[6])},${q(l2)},6,null,null,null);`);
  const registered = JSON.parse(await control.sql(`select json_build_object('id',id,'stamp',updated_at) from public.inventory where product_id=${q(p[6])} and location_id=${q(l1)};`));
  await b.sql(call('quantity', p[6], registered.id, l1, l1, '5', q(registered.stamp), '3'));
  await check('A: existing add-location RPC and explicit count preserve multiple rows', `select count(*)=2 and sum(quantity)=9 and max(quantity) filter(where location_id=${q(l2)})=6 from public.inventory where product_id=${q(p[6])};`);
  // B prototype: no counting schema, RPC or persisted counting records.
  for (const [label, sql] of [
    ['insert', `insert into public.inventory(id,product_id,location_id,zone_id,quantity) values(${q(i[7])},${q(p[7])},${q(l1)},${q(z)},1);`],
    ['move in', `update public.inventory set location_id=${q(l1)} where id=${q(i[6])};`],
    ['move out', `update public.inventory set location_id=${q(l2)} where id=${q(i[4])};`],
    ['delete', `delete from public.inventory where id=${q(i[4])};`],
    ['quantity', `update public.inventory set quantity=3 where id=${q(i[4])};`],
  ]) {
    await barrier();
    pending = b.sql('begin; ' + sql); pending.catch(() => {});
    await blocked(b, a);
    await check(`B: ${label} waits; snapshot remains stable`, `select quantity=10 and location_id=${q(l1)} from public.inventory where id=${q(i[4])};`);
    await a.sql('rollback;'); await pending; await b.sql('rollback;');
  }
  await a.sql(`begin; select id from public.locations where id=${q(empty)} for update nowait;`);
  pending = b.sql(`begin; insert into public.inventory(id,product_id,location_id,zone_id,quantity) values(${q(i[7])},${q(p[7])},${q(empty)},${q(z)},1);`); pending.catch(() => {});
  await blocked(b,a); await a.sql('rollback;'); await pending; await b.sql('rollback;');
  await check('B: empty location protected against first insertion', `select count(*)=0 from public.inventory where location_id=${q(empty)};`);
  await barrier();
  await b.sql(`begin; update public.inventory set quantity=5 where id=${q(i[6])}; rollback;`);
  await a.sql('rollback;');
  await check('B: unrelated location remains writable; rollback preserves it', `select quantity=6 from public.inventory where id=${q(i[6])};`);
  // Inverse writer order: full completion attempt must immediately abort and release parent.
  await b.sql(`begin; select id from public.inventory where id=${q(i[4])} for update;`);
  await a.sql(`begin; select id from public.locations where id=${q(l1)} for update nowait;`);
  pending = b.sql(`select id from public.locations where id=${q(l1)} for share;`); pending.catch(() => {});
  await blocked(b,a);
  await a.sql(expect(`select id from public.inventory where location_id=${q(l1)} order by id for update nowait;`, '55P03'));
  await a.sql('rollback;'); await pending; await b.sql('rollback;');
  await check('B: inverse writer order rejected NOWAIT without deadlock', `select quantity=10 from public.inventory where id=${q(i[4])};`);
  // Existing Viper's product -> location SHARE -> inventory order, without invoking Viper.
  await b.sql(`begin; select id from public.products where id=${q(p[4])} for share; select id from public.locations where id=${q(l1)} for share;`);
  await a.sql(expect(`select id from public.locations where id=${q(l1)} for update nowait;`, '55P03'));
  await b.sql('rollback;');
  results.push('B: Viper-style location SHARE prevents count completion');
  console.log('PASS:', results.at(-1));
  // New committed row must be visible in separate READ COMMITTED statement after locks.
  await a.sql('begin;');
  await b.sql(`insert into public.inventory(id,product_id,location_id,zone_id,quantity) values(${q(i[7])},${q(p[7])},${q(empty)},${q(z)},1);`);
  await a.sql(`select id from public.locations where id=${q(empty)} for update nowait; select id from public.inventory where location_id=${q(empty)} order by id for update nowait;`);
  assert.equal(await a.sql(`select count(*) from public.inventory where location_id=${q(empty)};`), '1');
  await a.sql('rollback;'); results.push('B: fresh snapshot detects newly committed row'); console.log('PASS:', results.at(-1));
  // Only this run's synthetic rows; no reset or deletion of previous evidence.
  await control.sql(guard + `\nbegin;
    delete from public.stock_movements where inventory_id in (select id from public.inventory where product_id in (${p.map(q)}));
    delete from public.activity_log where metadata->>'productId' in (${p.map(q)}) or metadata->>'product_id' in (${p.map(q)});
    delete from public.inventory where product_id in (${p.map(q)});
    delete from public.products where id in (${p.map(q)});
    delete from public.locations where id in (${manifest.locations.map(q)});
    delete from public.zones where id=${q(z)}; commit;`);
  const after = await control.sql(stateSQL);
  writeFileSync(`${dir}/after.json`, after);
  assert.equal(after, before, 'Existing database state preserved');
  results.push('Existing state preserved after removal of owned synthetic fixtures');
  writeFileSync(`${dir}/result.json`, JSON.stringify({ status: 'passed', results }, null, 2));
  console.log(`${results.length} checks passed. Evidence: ${dir}`);
} catch (error) {
  writeFileSync(`${dir}/result.json`, JSON.stringify({ status: 'stopped', results, error: String(error) }, null, 2));
  console.error('STOP: preserve evidence and committed synthetic fixtures. No reset or automatic retry.', String(error));
  process.exitCode = 1;
} finally {
  for (const s of sessions) s.child.stdin.end('rollback;\n\\q\n');
}
