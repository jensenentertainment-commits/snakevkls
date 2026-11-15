// One fixed disposable local database; never loads .env or connects to Supabase.
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
const migration = 'supabase/migrations/20261115153609_durable_location_count_sessions.sql';
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith('PG')));
Object.assign(env,{ PGHOST:'127.0.0.1',PGPORT:'55433',PGUSER:'snake_catalog_test',PGDATABASE:'snake_phase2a_test_catalogfresh',
  PGPASSFILE:'C:/Users/jense/AppData/Local/SnakeCatalogValidation/pgpass.conf',PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5',
  PGOPTIONS:'-c snake.phase2a_isolated=on -c statement_timeout=30000 -c lock_timeout=2000',PGAPPNAME:'warehouse-package-b-rollback' });
if(process.argv.length!==3 || !['--preflight','--rollback-test'].includes(process.argv[2])) throw Error('Use --preflight or --rollback-test; fixed local target only');
const source = readFileSync(migration,'utf8');
const before = `select md5(coalesce(string_agg(row_to_json(i)::text,'' order by id),'')) as inventory_hash from public.inventory i;
select count(*) as counts from public.location_counts; select count(*) as activity from public.activity_log;`;
const sql = readFileSync('tests/database/roy-phase-2a-acceptance.guard.sql','utf8') + `
do $$ begin if to_regclass('public.location_count_sessions') is not null then raise exception 'Unexpected existing session schema: stop, no reset'; end if; end $$;
` + before + (process.argv[2]==='--rollback-test' ? '\nbegin;\n'+source+'\n'+readFileSync('tests/database/warehouse-package-b.sql','utf8')+'\nrollback;\n'+before : '');
const result = spawnSync('C:/Users/jense/AppData/Local/SnakeViperValidation/tools/pgsql/bin/psql.exe',['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-f','-'],
 { env,input:sql,encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:4*1024*1024 });
const dir = `coverage/warehouse-package-b/rollback-${randomUUID()}`; mkdirSync(dir,{recursive:true});
writeFileSync(`${dir}/result.json`,JSON.stringify({ migration,sha256:createHash('sha256').update(source).digest('hex'),exit:result.status,stdout:result.stdout,stderr:result.stderr },null,2));
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
if(result.error || result.status!==0) throw Error('Local test failed; transaction rolls back on disconnect. Evidence preserved. No reset or remote fallback.');
if(process.argv[2]==='--rollback-test') {
 const lines=result.stdout.trim().split(/\r?\n/).filter(Boolean);
 if(JSON.stringify(lines.slice(0,3))!==JSON.stringify(lines.slice(-3))) throw Error('Rollback state mismatch');
 console.log('PASS: rollback preserved inventory, existing counts and activity');
}
console.log('Evidence:',dir);
