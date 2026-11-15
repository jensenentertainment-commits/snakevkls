// Synthetic rollback-only acceptance. No .env loading and no remote target support.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const bin='C:/Users/jense/AppData/Local/SnakeViperValidation/tools/pgsql/bin/psql.exe';
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG')));
Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:'55433',PGUSER:'snake_catalog_test',
 PGDATABASE:'snake_phase2a_test_catalogfresh',PGPASSFILE:'C:/Users/jense/AppData/Local/SnakeCatalogValidation/pgpass.conf',
 PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5',PGOPTIONS:'-c snake.phase2a_isolated=on -c statement_timeout=30000 -c lock_timeout=2000',PGAPPNAME:'warehouse-package-a-rollback'});
const guard=readFileSync('tests/database/roy-phase-2a-acceptance.guard.sql','utf8');
const mode=process.argv[2];
if(!['--preflight','--rollback-test'].includes(mode)||process.argv.length!==3)throw Error('Use --preflight or --rollback-test; fixed local target only');
const sql=guard+"\nselect 'Local identity verified; PostgreSQL ' || current_setting('server_version');\n"+
 (mode==='--rollback-test'?`
select md5(pg_get_functiondef('public.set_product_location(uuid,uuid,uuid,uuid,integer,uuid,text,text)'::regprocedure)) as legacy_hash,
 (select count(*) from public.inventory) as inventory_count,
 (select coalesce(sum(quantity),0) from public.inventory) as inventory_quantity,
 (select count(*) from public.stock_movements) as movement_count,
 (select count(*) from public.activity_log) as activity_count
\u005cgset
begin;
`+readFileSync('supabase/migrations/20261115140231_safe_product_placement_retire_cleanup.sql','utf8')+'\n'+readFileSync('tests/database/warehouse-package-a.sql','utf8')+`
rollback;
select 1 / ((
 md5(pg_get_functiondef('public.set_product_location(uuid,uuid,uuid,uuid,integer,uuid,text,text)'::regprocedure))=:'legacy_hash'
 and to_regprocedure('public.save_product_placement_v2(text,uuid,uuid,uuid,uuid,uuid,integer,timestamptz,integer,uuid,text,text)') is null
 and (select count(*) from public.inventory)=:inventory_count
 and (select coalesce(sum(quantity),0) from public.inventory)=:inventory_quantity
 and (select count(*) from public.stock_movements)=:movement_count
 and (select count(*) from public.activity_log)=:activity_count
)::integer) as rollback_verified;
`: '');
const result=spawnSync(bin,['-X','-w','-q','-v','ON_ERROR_STOP=1','-f','-'],{env,input:sql,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:1024*1024});
if(result.error)throw Error('Local PostgreSQL client unavailable; no other target attempted');
// Contains only synthetic assertion labels and SQL diagnostics, never credentials.
process.stdout.write(result.stdout);process.stderr.write(result.stderr);
if(result.status!==0)throw Error('Local check failed. No reset or alternate target attempted. Transaction is rolled back on connection close.');
