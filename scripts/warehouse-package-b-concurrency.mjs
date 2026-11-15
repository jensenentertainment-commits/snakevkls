// Isolated acceptance: fixed local target, exact guard on every connection.
// Installs only the candidate locally; on success removes only its objects/manifest fixtures.
// On failure retains evidence and database state. Never resets a database.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG')));
Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:'55433',PGUSER:'snake_catalog_test',PGDATABASE:'snake_phase2a_test_catalogfresh',
 PGPASSFILE:'C:/Users/jense/AppData/Local/SnakeCatalogValidation/pgpass.conf',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5',
 PGOPTIONS:'-c snake.phase2a_isolated=on -c statement_timeout=20000 -c lock_timeout=10000'});
if(process.argv.length!==3 || process.argv[2]!=='--run') throw Error('Use --run; fixed local test target only');
const migration=readFileSync('supabase/migrations/20261115153609_durable_location_count_sessions.sql','utf8');
const run=randomUUID(), dir=`coverage/warehouse-package-b/concurrency-${run}`;
mkdirSync(dir,{recursive:true});
const manifest={run,zone:randomUUID(),locations:[randomUUID(),randomUUID(),randomUUID()],products:[randomUUID(),randomUUID(),randomUUID()],inventory:[randomUUID(),randomUUID(),randomUUID()],actor:randomUUID(),migrationSha256:createHash('sha256').update(migration).digest('hex')};
writeFileSync(`${dir}/manifest.json`,JSON.stringify(manifest,null,2));
const connections=[], results=[];
function connection(name) {
 const child=spawn('C:/Users/jense/AppData/Local/SnakeViperValidation/tools/pgsql/bin/psql.exe',['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-f','-'],{env:{...env,PGAPPNAME:`count-b-${name}-${run}`},windowsHide:true});
 let pending, output='', errors='',seq=0;
 child.stdout.on('data',data=>{output+=data.toString().replaceAll('\r','');if(pending&&output.includes(pending.marker+'\n')) {const value=output.slice(0,output.indexOf(pending.marker)).trim();output='';const resolve=pending.resolve;pending=null;resolve(value);}});
 child.stderr.on('data',data=>{errors+=data;});
 child.on('error',error=>pending?.reject(error));
 child.on('exit',code=>{if(pending){pending.reject(Error(`${name} exited ${code}: ${errors}`));pending=null;}});
 const s={child,pid:null,sql(sql){assert(!pending);const marker=`DONE_${name}_${++seq}`;const promise=new Promise((resolve,reject)=>{pending={marker,resolve,reject};});promise.catch(()=>{});child.stdin.write(sql+'\n\\echo '+marker+'\n');return promise;}};
 connections.push(s);return s;
}
const a=connection('a'),b=connection('b'),c=connection('control');
const q=x=>`'${x}'`, [l,other,empty]=manifest.locations,[p,p2,p3]=manifest.products,[i,i2,i3]=manifest.inventory,z=manifest.zone;
const guard=readFileSync('tests/database/roy-phase-2a-acceptance.guard.sql','utf8');
const state=`select json_build_object('inventory',(select md5(coalesce(string_agg(row_to_json(t)::text,'' order by id),'')) from public.inventory t),
 'counts',(select count(*) from public.location_counts),'activity',(select count(*) from public.activity_log),'movements',(select count(*) from public.stock_movements),
 'products',(select count(*) from public.products),'locations',(select count(*) from public.locations),'zones',(select count(*) from public.zones));`;
const call=(action,loc,sid=null,version=null,inv=null,quantity=null)=>`select public.manage_location_count_v1('${action}',${q(loc)},${sid?q(sid):'null'},${version??'null'},${inv?q(inv):'null'},${quantity??'null'},null,${q(manifest.actor)},null,'Synthetic');`;
const expect=(sql,code)=>`do $test$ begin begin ${sql.replace(/^select /,'perform ')} raise exception 'Expected rejection did not occur'; exception when sqlstate '${code}' then null; end; end $test$;`;
async function pass(label,sql) {if(sql) assert.equal(await c.sql(sql),'t',label);results.push(label);console.log('PASS:',label);}
async function blocked(waiter,blocker) {
 const start=Date.now();while(Date.now()-start<5000){if(await c.sql(`select ${blocker.pid}=any(pg_blocking_pids(${waiter.pid}));`)==='t')return;await new Promise(resolve=>setTimeout(resolve,25));}
 throw Error('Expected lock wait not observed');
}
let before;
try {
 for(const s of connections){await s.sql(guard);s.pid=Number(await s.sql('select pg_backend_pid();'));}
 before=await c.sql(state);writeFileSync(`${dir}/before.json`,before);
 await c.sql(`do $$ begin if to_regclass('public.location_count_sessions') is not null or exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='count_revision') then raise exception 'Candidate already installed: stop without reset'; end if; end $$;`);
 await c.sql('begin;\n'+migration+'\ncommit;');
 await c.sql(`begin;
 insert into public.zones(id,code,name,pick_priority) values(${q(z)},'CB-${run}','Synthetic count concurrency',99996);
 insert into public.locations(id,code,zone_id,active,pick_sequence) values ${manifest.locations.map((id,n)=>`(${q(id)},'CB-${id}',${q(z)},true,${n+1})`).join(',')};
 insert into public.products(id,product_name,sku) values ${manifest.products.map(id=>`(${q(id)},'Synthetic count ${run}',null)`).join(',')};
 insert into public.inventory(id,product_id,location_id,zone_id,quantity) values(${q(i)},${q(p)},${q(l)},${q(z)},10),(${q(i2)},${q(p2)},${q(other)},${q(z)},4);
 commit;`);
 // Two starts cannot create two active sessions; first session persists across connections.
 await a.sql('begin;');let s=JSON.parse(await a.sql(call('start',l)));const sid=s.id;
 await b.sql(expect(call('start',l),'55P03'));await a.sql('commit;');
 s=JSON.parse(await b.sql(call('start',l)));assert.equal(s.id,sid);await pass('concurrent starts resume exactly one active session');
 s=JSON.parse(await a.sql(call('save',l,sid,1,i,9)));
 const loaded=JSON.parse(await b.sql(`select public.get_location_count_session_v1(${q(l)});`));assert.deepEqual(loaded,s);
 await pass('saved progress visible to another connection');
 // Completion holds exact implemented locks while other writers attempt their operation.
 for(const [label,sql] of [
  ['insert',`insert into public.inventory(id,product_id,location_id,zone_id,quantity) values(${q(i3)},${q(p3)},${q(l)},${q(z)},1);`],
  ['move in',`update public.inventory set location_id=${q(l)} where id=${q(i2)};`],
  ['move out',`update public.inventory set location_id=${q(other)} where id=${q(i)};`],
  // A saved count creates the existing FK reference; deletion of a different, unsaved row is covered below.
  ['quantity',`update public.inventory set quantity=8 where id=${q(i)};`],
 ]) {
  await a.sql('begin;'+call('complete',l,sid,2));
  const pending=b.sql('begin;'+sql);await blocked(b,a);
  await pass(`completion blocks ${label} on same location`);
  await a.sql('rollback;');await pending;await b.sql('rollback;');
 }
 await a.sql('begin;'+call('complete',l,sid,2));
 await b.sql(`begin;update public.inventory set quantity=3 where id=${q(i2)};rollback;`);
 await pass('unrelated location remains writable');await a.sql('rollback;');
 await b.sql(`begin;update public.inventory set quantity=8 where id=${q(i)};`);
 await a.sql(expect(call('complete',l,sid,2),'55P03'));await b.sql('rollback;');await pass('writer first causes immediate safe conflict');
 // Fresh set membership after a committed insertion: no silent rebase.
 await b.sql(`insert into public.inventory(id,product_id,location_id,zone_id,quantity) values(${q(i3)},${q(p3)},${q(l)},${q(z)},1);`);
 await a.sql(expect(call('complete',l,sid,2),'40001'));await pass('new committed row invalidates full count');
 await b.sql(`delete from public.inventory where id=${q(i3)};`);
 // Actual empty-location completion excludes first insertion.
 let e=JSON.parse(await a.sql(call('start',empty)));
 await a.sql('begin;'+call('complete',empty,e.id,1));
 let pending=b.sql(`begin;insert into public.inventory(id,product_id,location_id,zone_id,quantity) values(${q(i3)},${q(p3)},${q(empty)},${q(z)},1);`);
 await blocked(b,a);await a.sql('rollback;');await pending;await b.sql('rollback;');await pass('empty-location completion excludes new first row');
 // Unsaved source row deletion during save attempt is detected and does not deadlock.
 let otherSession=JSON.parse(await a.sql(call('start',other)));
 await b.sql(`begin;delete from public.inventory where id=${q(i2)};`);
 await a.sql(expect(call('save',other,otherSession.id,1,i2,4),'55P03'));await b.sql('rollback;');await pass('concurrent deletion rejects count command safely');
 // Concurrent saves of one session cannot overwrite each other.
 await a.sql('begin;'+call('save',l,sid,2,i,8));await b.sql(expect(call('save',l,sid,2,i,7),'55P03'));await a.sql('rollback;');
 await pass('concurrent line saves are serialized');
 // One completion event even with retry after a concurrent in-flight request.
 await a.sql('begin;'+call('complete',l,sid,2));await b.sql(expect(call('complete',l,sid,2),'55P03'));await a.sql('commit;');
 s=JSON.parse(await b.sql(call('complete',l,sid,2)));assert.equal(s.status,'completed');
 await pass('completion replay writes only one event',`select count(*)=1 from public.activity_log where action='location_count_completed' and metadata->>'sessionId'=${q(sid)};`);
 await pass('counts never reduce inventory',`select quantity=10 from public.inventory where id=${q(i)};`);
 // Clear only this manifest's synthetic records and remove this newly installed candidate.
 await c.sql(`begin;
 delete from public.activity_log where entity_id in (${manifest.locations.map(q).join(',')});
 delete from public.location_count_session_lines where session_id in(select id from public.location_count_sessions where location_id in (${manifest.locations.map(q).join(',')}));
 delete from public.location_counts where location_id in (${manifest.locations.map(q).join(',')});
 delete from public.location_count_sessions where location_id in (${manifest.locations.map(q).join(',')});
 delete from public.inventory where id in (${manifest.inventory.map(q).join(',')});
 delete from public.products where id in (${manifest.products.map(q).join(',')});
 delete from public.locations where id in (${manifest.locations.map(q).join(',')});
 delete from public.zones where id=${q(z)};
 do $$ begin if exists(select 1 from public.location_count_sessions) then raise exception 'Unexpected session data; preserve schema'; end if; end $$;
 drop trigger guard_location_count_completion_v1 on public.activity_log;
 drop index public.location_count_completion_once;
 drop function public.guard_location_count_completion_v1();
 drop function public.manage_location_count_v1(text,uuid,uuid,integer,uuid,integer,text,uuid,text,text);
 drop function public.get_location_count_session_v1(uuid);
 drop table public.location_count_session_lines;
 alter table public.location_counts drop column session_id;
 drop table public.location_count_sessions;
 drop trigger inventory_count_revision_v1 on public.inventory;
 drop function public.inventory_count_revision_v1();
 alter table public.inventory drop column count_revision;
 commit;`);
 const after=await c.sql(state);writeFileSync(`${dir}/after.json`,after);assert.equal(after,before);
 await pass('existing local database state restored without reset');
 writeFileSync(`${dir}/result.json`,JSON.stringify({passed:results.length,failed:0,results},null,2));
 console.log('Evidence:',dir);
} catch(error) {
 writeFileSync(`${dir}/failure.txt`,String(error));console.error('STOP: candidate/fixtures preserved; no reset:',error);process.exitCode=1;
} finally {for(const s of connections)s.child.stdin.end();}
