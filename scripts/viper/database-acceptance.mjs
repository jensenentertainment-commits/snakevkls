// Explicit disposable-target runner. No .env files, provisioning or automatic reset.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const TEST_PROJECT = 'mvwpbscexvnfavxhbexb';
export const TEST_SYSTEM_ID = '7702071863184491885';
export const TEST_HOST = 'db.mvwpbscexvnfavxhbexb.supabase.co';
export function configuration(args, env) {
  if (!args.length || (args.length === 1 && args[0] === '--plan')) return null;
  if (args.length !== 3 || args[0] !== '--execute' || args[1] !== TEST_PROJECT
      || args[2] !== 'EXECUTE ISOLATED VIPER snake-test ' + TEST_PROJECT)
    throw new Error('Explicit snake-test project confirmation required');
  if (env.PGHOST !== TEST_HOST || env.PGPORT !== '5432' || env.PGDATABASE !== 'postgres'
      || env.PGUSER !== 'postgres' || env.PGSSLMODE !== 'verify-full'
      || !env.PGSSLROOTCERT || !isAbsolute(env.PGSSLROOTCERT) || !existsSync(env.PGSSLROOTCERT)
      || !env.PGPASSFILE || !isAbsolute(env.PGPASSFILE) || !existsSync(env.PGPASSFILE)
      || !env.VIPER_TEST_PSQL || !isAbsolute(env.VIPER_TEST_PSQL) || !existsSync(env.VIPER_TEST_PSQL)
      || env.PGSERVICE || env.PGSERVICEFILE || env.PGHOSTADDR || env.PGPASSWORD
      || !env.VIPER_TEST_EVIDENCE || !isAbsolute(env.VIPER_TEST_EVIDENCE)
      || existsSync(env.VIPER_TEST_EVIDENCE)) throw new Error('Pinned snake-test host, TLS, protected credential file and NEW evidence path required');
  const childEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('PG')));
  Object.assign(childEnv, { PGHOST: TEST_HOST, PGPORT: '5432', PGDATABASE: 'postgres',
    PGUSER: 'postgres', PGPASSFILE: env.PGPASSFILE, PGSSLMODE: 'verify-full', PGSSLROOTCERT: env.PGSSLROOTCERT,
    PGCONNECT_TIMEOUT: '10', PGOPTIONS: '-c snake.viper_isolated=on -c statement_timeout=60000 -c lock_timeout=5000' });
  return { database: 'postgres', project: TEST_PROJECT, childEnv, psql: env.VIPER_TEST_PSQL,
    systemId: TEST_SYSTEM_ID, evidence: env.VIPER_TEST_EVIDENCE };
}

export function execute(config) {
  const evidence = { project: config.project, database: config.database, startedAt: new Date().toISOString(), results: [], status: 'RUNNING' };
  const persist = () => writeFileSync(config.evidence, JSON.stringify(evidence, null, 2), { mode: 0o600 });
  function run(label, args, hash) {
    const result = spawnSync(config.psql, ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', ...args],
      { cwd: root, env: config.childEnv, shell: false, windowsHide: true, encoding: 'utf8', timeout: 90000, maxBuffer: 4*1024*1024 });
    evidence.results.push({ label, hash, exitCode: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message });
    persist();
    if (result.status !== 0 || result.error) throw new Error(`Stopped at ${label}; retained evidence: ${config.evidence}`);
    return result.stdout.trim();
  }
  const guard = 'tests/database/viper-acceptance.guard.sql';
  function file(path) {
    const hash = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
    run(path, ['-1', '-f', guard, '-f', path], hash);
  }
  try {
    const identity = JSON.parse(run('identity', ['-c', `select json_build_object('systemId',system_identifier::text,'version',current_setting('server_version_num'),'database',current_database(),'role',current_user,'tls',(select ssl from pg_stat_ssl where pid=pg_backend_pid())) from pg_control_system()`]));
    evidence.identity = identity;
    if (identity.systemId !== TEST_SYSTEM_ID || identity.database !== 'postgres'
        || identity.role !== 'postgres' || identity.tls !== true
        || Number(identity.version) < 170000 || Number(identity.version) >= 180000)
      throw new Error('snake-test identity mismatch; no migrations executed');
    run('empty-target', ['-f', guard, '-c', `do $$ begin
      if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p'))
        or to_regnamespace('private') is not null or to_regclass('auth.users') is null
      then raise exception 'Empty Snake application schemas and managed Supabase auth required'; end if;
      if exists(select 1 from auth.users) then raise exception 'Synthetic empty auth population required'; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then raise exception 'Managed roles missing'; end if;
    end $$;`]);
    // Managed Supabase owns auth/roles: NEVER run supabase-local-bootstrap.sql here.
    for (const name of readdirSync(resolve(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()) {
      if (name === '20260819182058_future_foundation_physical_pick_order.sql') file('tests/database/viper-historical-baseline.sql');
      file(`supabase/migrations/${name}`);
    }
    // The fixture owns BEGIN/ROLLBACK; do not wrap it in psql -1.
    const fixture = 'tests/database/viper-v1-location-validation.dynamic.sql';
    run(fixture, ['-f', guard, '-f', fixture], createHash('sha256').update(readFileSync(resolve(root,fixture))).digest('hex'));
    run('fixture-rollback', ['-f', guard, '-c', `do $$ begin if exists(select 1 from public.products) or exists(select 1 from public.orders) or exists(select 1 from public.inventory) or exists(select 1 from public.zones where code='VT') then raise exception 'Fixture data survived rollback'; end if; end $$;`]);
    evidence.status = 'PASS';
  } catch(error) { evidence.status = 'FAIL'; evidence.failure = error.message; throw error; }
  finally { evidence.finishedAt = new Date().toISOString(); persist(); }
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const config = configuration(process.argv.slice(2), process.env);
    if (!config) console.log('Plan only: pinned snake-test project mvwpbscexvnfavxhbexb, verify-full direct TLS, empty application schemas, existing managed auth, ordered migrations, synthetic baseline, Viper step 1 and rollback verification. No connection made.');
    else console.log(JSON.stringify({ status: execute(config).status, evidence: config.evidence }));
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
