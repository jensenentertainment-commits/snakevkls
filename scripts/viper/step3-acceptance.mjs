import {concurrency} from './step3-concurrency.mjs';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {configuration,TEST_SYSTEM_ID} from './database-acceptance.mjs';
const mode=process.argv.at(-1);
if(!['--apply-step3','--verify-step3','--refresh-step3'].includes(mode)) throw new Error('Explicit step3 mode required');
const config=configuration(process.argv.slice(2,-1),process.env);
if(!config)throw new Error('Explicit target confirmation required');
const guard='tests/database/viper-acceptance.guard.sql';
const evidence={startedAt:new Date().toISOString(),results:[],status:'RUNNING'};
const persist=()=>writeFileSync(config.evidence,JSON.stringify(evidence,null,2));
function run(label,args) {
 const r=spawnSync(config.psql,['-X','-w','-qAt','-v','ON_ERROR_STOP=1',...args],{env:config.childEnv,encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:4*1024*1024});
 evidence.results.push({label,exitCode:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message});persist();
 if(r.status!==0||r.error)throw new Error('Failed: '+label);
 return r.stdout.trim();
}
function file(path,transaction=false){
 evidence.results.push({file:path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
 return run(path,[...(transaction?['-1']:[]),'-f',guard,'-f',path]);
}
function sql(label,query){return run(label,['-f',guard,'-c',query]);}
try {
 const id=JSON.parse(sql('identity',"select json_build_object('id',system_identifier::text,'version',current_setting('server_version'),'tls',(select ssl from pg_stat_ssl where pid=pg_backend_pid())) from pg_control_system()"));
 if(id.id!==TEST_SYSTEM_ID||id.tls!==true)throw new Error('Identity mismatch');
 sql('empty-fixture-population',"do $$ begin if exists(select 1 from public.products) or exists(select 1 from public.orders) or exists(select 1 from public.inventory) or exists(select 1 from auth.users) then raise exception 'Expected synthetic empty populations'; end if; end $$;");
 if(mode==='--apply-step3')file('supabase/migrations/20261104201000_viper_fresh_start_completion.sql',true);
 if(mode==='--refresh-step3') {
   const path='supabase/migrations/20261104201000_viper_fresh_start_completion.sql';
   const migration=readFileSync(path,'utf8');
   const body=migration.slice(migration.indexOf('create function public.apply_viper_pick_command(')).replace('create function','create or replace function');
   evidence.results.push({file:path,sha256:createHash('sha256').update(migration).digest('hex'),operation:'replace only development command function'});
   sql('refresh-step3-function',body);
 }
 file('tests/database/viper-v1-location-validation.dynamic.sql');
 file('tests/database/viper-v3-source-stock.dynamic.sql');
 sql('rollback-verification',"do $$ begin if exists(select 1 from public.products) or exists(select 1 from public.orders) or exists(select 1 from public.inventory) or exists(select 1 from private.viper_commands) or exists(select 1 from auth.users) then raise exception 'Fixture leaked'; end if; end $$;");
 await concurrency(config,sql,file,evidence,persist);
 sql('final-clean-populations',"do $$ begin assert not exists(select 1 from public.products); assert not exists(select 1 from public.orders); assert not exists(select 1 from public.inventory); assert not exists(select 1 from private.viper_commands); assert not exists(select 1 from auth.users); end $$;");
 evidence.status='PASS';
} catch(error){evidence.status='FAIL';evidence.failure=error.message;process.exitCode=1;}
finally{evidence.finishedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:evidence.status,failure:evidence.failure,evidence:config.evidence}));}
