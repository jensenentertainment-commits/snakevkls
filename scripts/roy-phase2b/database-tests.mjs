// Explicit loopback-only synthetic tests. No .env, remote clients or acceptance resets.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const psql='C:/Users/jense/AppData/Local/SnakeViperValidation/tools/pgsql/bin/psql.exe';
const env={...process.env};
for (const key of Object.keys(env)) if (/^PG/i.test(key)) delete env[key];
env.PGPASSFILE='C:/Users/jense/AppData/Local/SnakeCatalogValidation/pgpass.conf';
env.PGSSLMODE='disable';
const args=['-X','-w','-q','-A','-t','-h','127.0.0.1','-p','55433','-U','snake_catalog_test','-d','snake_phase2a_test_catalogfresh','-v','ON_ERROR_STOP=1'];
const guard=readFileSync(new URL('../../tests/database/roy-phase-2a-acceptance.guard.sql',import.meta.url),'utf8');
const begin=`begin; set local snake.phase2a_isolated='on';\n${guard}\n`;
function query(sql) {
  const r=spawnSync(psql,args,{cwd:root,env,input:sql,encoding:'utf8',timeout:30000});
  if (r.error || r.status!==0) throw new Error(r.stderr || String(r.error));
  return r.stdout.trim();
}
let sequence=0;
function session() {
  const p=spawn(psql,args,{cwd:root,env,stdio:['pipe','pipe','pipe']});
  let output='',errors=''; let waiter=null;
  p.stdout.on('data',d=>{output+=d; if(waiter&&output.includes(waiter.marker)){const w=waiter;waiter=null;clearTimeout(w.timer);w.resolve(output);}});
  p.stderr.on('data',d=>{errors+=d;});
  p.on('exit',code=>{if(waiter){clearTimeout(waiter.timer);waiter.reject(new Error(`psql exit ${code}: ${errors}`));waiter=null;}});
  return { async send(sql) {
    const marker=`ROY_TEST_READY_${++sequence}`;
    return await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{p.kill();reject(new Error('Local test session timed out'));},30000);
      waiter={marker,resolve,reject,timer};p.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
  }, close(){p.stdin.end('rollback;\n\\q\n');} };
}
if (process.argv.length!==3 || process.argv[2]!=='--execute-approved') {
  console.log('Plan only. Requires explicit --execute-approved; local synthetic rollback tests only.');
} else {
  const before=query(`${begin} select current_setting('server_version'); select to_regclass('public.roy_review_runs') is null; rollback;`);
  if (!before.includes('17.11') || !before.endsWith('t')) throw new Error('Expected PG17.11 and no existing Roy review schema');
  const dynamic=spawnSync(psql,[...args,'-f','tests/database/roy-phase2b.dynamic.sql'],{cwd:root,env,encoding:'utf8',timeout:30000});
  if(dynamic.status!==0) throw new Error(dynamic.stderr);
  console.log(dynamic.stderr);console.log(dynamic.stdout);
  const migration=readFileSync(new URL('../../supabase/migrations/20261109191325_roy_catalog_review.sql',import.meta.url),'utf8');
  const setup=`${begin}${migration}
    insert into auth.users(id) values('97000000-0000-4000-8000-000000000093');
    insert into public.profiles(id,email,role,display_name,active) values('97000000-0000-4000-8000-000000000093','concurrency@example.test','admin','Synthetic concurrency',true);
    select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000093',true); set local role authenticated;`;
  for(const [name,lock] of [
    ['catalog writer', 'lock table public.products in row exclusive mode;'],
    ['sync claim', 'lock table private.sync_runs in row exclusive mode;'],
    ['concurrent review',"select pg_advisory_xact_lock(hashtextextended('snake_roy_review',0));"]
  ]) {
    const holder=session();const review=session();
    try {
      await holder.send(begin+lock);
      await review.send(setup+`do $$ begin
        begin perform public.run_roy_review_v1(gen_random_uuid()); raise exception 'Conflict not rejected'; exception when lock_not_available then null; end;
        if exists(select 1 from public.roy_review_runs) then raise exception 'Partial report'; end if;
      end $$; rollback;`);
      await holder.send('rollback;');
      console.log(`PASS: ${name} rejects review without partial writes`);
    } finally {review.close();holder.close();}
  }
  const holder=session();
  try {
    await holder.send(setup+`select public.run_roy_review_v1('97000000-0000-4000-8000-000000000198');`);
    for(const table of ['public.products','public.shopify_product_content','public.shopify_product_collections','private.sync_runs']) {
      query(begin+`do $$ begin begin lock table ${table} in row exclusive mode nowait; raise exception 'Source write admitted'; exception when lock_not_available then null; end; end $$; rollback;`);
      console.log(`PASS: review excludes concurrent source writes to ${table}`);
    }
    await holder.send('rollback;');
  } finally {holder.close();}
  if(query(begin+"select to_regclass('public.roy_review_runs') is null; rollback;")!=='t') throw new Error('Rollback postcheck failed');
  console.log('PASS: all test schema/data rolled back; prior local target preserved');
}
