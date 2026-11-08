// Prepared executable acceptance only. Import/default invocation never connects.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { proveBackfill } from '../../lib/shopify/backfill-proof.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const db = 'tests/database/';
const guard = `${db}roy-phase-2a-acceptance.guard.sql`;
export const LOCAL_CATALOG_TARGET = Object.freeze({
  host: '127.0.0.1', port: '55433', user: 'snake_catalog_test',
  systemId: '7705827962930311860',
  dataDirectory: 'C:/Users/jense/AppData/Local/SnakeCatalogValidation/data',
  passwordFile: 'C:/Users/jense/AppData/Local/SnakeCatalogValidation/pgpass.conf',
  databases: { fresh: 'snake_phase2a_test_catalogfresh', upgrade: 'snake_phase2a_test_catalogupgrade' },
});
export const plan = 'Prepared, NOT RUN. On two separately approved EMPTY disposable databases run fresh and upgrade matrices. Requires existing psql, loopback connection, PGDATABASE matching snake_phase2a_test[_suffix], and exact --confirm. No provisioning. Existing independent-session suites remain required; see docs/roy-phase-2a-forward-fix.md.';

export function options(args, env) {
  if (!args.length || (args.length === 1 && args[0] === '--plan')) return null;
  const flags = new Map();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--execute', '--matrix', '--database', '--confirm'].includes(key) || flags.has(key)) throw new Error('Invalid acceptance flags');
    if (key === '--execute') flags.set(key, true);
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('Missing acceptance value');
      flags.set(key, value);
    }
  }
  const matrix = flags.get('--matrix'), database = flags.get('--database');
  if (!flags.get('--execute') || !['fresh', 'upgrade'].includes(matrix)
      || typeof database !== 'string' || !/^snake_phase2a_test(?:_[a-z0-9]+)?$/.test(database)
      || flags.get('--confirm') !== `EXECUTE ISOLATED ${matrix} ${database}`) throw new Error('Explicit isolated matrix approval required');
  if (database !== LOCAL_CATALOG_TARGET.databases[matrix]
      || env.PGDATABASE !== database || env.PGHOST !== LOCAL_CATALOG_TARGET.host
      || env.PGPORT !== LOCAL_CATALOG_TARGET.port || env.PGUSER !== LOCAL_CATALOG_TARGET.user
      || env.PGPASSWORD || env.PGPASSFILE?.replaceAll('\\', '/') !== LOCAL_CATALOG_TARGET.passwordFile
      || env.PGSSLMODE !== 'disable'
      || env.PGSERVICE || env.PGSERVICEFILE || env.PGHOSTADDR)
    throw new Error('Only the approved local catalog cluster and matrix database are allowed');
  // Do not inherit PGOPTIONS/search-path/service settings or use shell commands.
  const childEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('PG')));
  for (const key of ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSFILE', 'PGSSLMODE']) if (env[key]) childEnv[key] = env[key];
  childEnv.PGDATABASE = database;
  childEnv.PGOPTIONS = '-c snake.phase2a_isolated=on -c statement_timeout=60000 -c lock_timeout=20000';
  childEnv.PGCONNECT_TIMEOUT = '5';
  return { matrix, database, childEnv };
}

export function acceptanceResult(snapshot) {
  const proof = proveBackfill(snapshot);
  if (proof.status !== 'PASS') throw new Error(`Real SQL export failed offline proof: ${proof.checks.filter(c => c.status !== 'PASS').map(c => c.code).join(', ')}`);
  // Proof deliberately retains its independent production/validation gate.
  if (proof.activation !== 'BLOCKED — separate database validation, rollout and activation approval required') throw new Error('Activation gate changed');
  return proof;
}

export async function execute(config) {
  const children = new Set();
  function psql(extra, application = 'phase2a-acceptance') {
    return new Promise((resolveResult, reject) => {
      const child = spawn('psql', ['-X', '-qAt', '-w', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', ...extra],
        { cwd: root, env: { ...config.childEnv, PGAPPNAME: application }, shell: false, windowsHide: true });
      children.add(child);
      let stdout = '', stderr = '';
      const timer = setTimeout(() => child.kill(), 90000);
      child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 2 * 1024 * 1024) child.kill(); });
      child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 2 * 1024 * 1024) child.kill(); });
      child.on('error', () => { clearTimeout(timer); children.delete(child); reject(new Error('Existing psql unavailable; no tooling installed')); });
      child.on('close', code => { clearTimeout(timer); children.delete(child); resolveResult({ code, stdout: stdout.trim(), stderr }); });
    });
  }
  async function checked(args, app) {
    const result = await psql(args, app);
    if (result.code !== 0) throw new Error(`Acceptance SQL failed (${app ?? 'matrix'}); retain restricted psql diagnostics via an approved local test session`);
    return result.stdout;
  }
  const sql = text => checked(['-f', guard, '-c', text]);
  const file = (name, app) => checked(['-f', guard, '-f', `${db}${name}.sql`], app);
  async function barrier(number, application) {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      // Values are fixture constants, never caller-supplied SQL.
      if (await sql(`select exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid where l.locktype='advisory' and l.classid=991 and l.objid=${number} and l.objsubid=2 and l.granted and a.application_name='${application}')`) === 't') return;
      await new Promise(resolveWait => setTimeout(resolveWait, 25));
    }
    throw new Error('Fixture barrier not reached');
  }
  async function overlap(first, appA, number, second, appB) {
    // Attach rejection handlers immediately while awaiting the visible barrier.
    const a = file(first, appA).then(value => ({ value }), error => ({ error }));
    await barrier(number, appA);
    const b = file(second, appB).then(value => ({ value }), error => ({ error }));
    for (const result of await Promise.all([a, b])) if (result.error) throw result.error;
  }
  try {
    const identity = JSON.parse(await checked(['-c', `select json_build_object(
      'systemId',system_identifier::text,'dataDirectory',current_setting('data_directory'),
      'version',current_setting('server_version_num'),'database',current_database(),
      'user',current_user,'address',host(inet_server_addr()),'port',inet_server_port()) from pg_control_system()`]));
    if (identity.systemId !== LOCAL_CATALOG_TARGET.systemId
        || identity.dataDirectory.replaceAll('\\', '/') !== LOCAL_CATALOG_TARGET.dataDirectory
        || identity.database !== config.database || identity.user !== LOCAL_CATALOG_TARGET.user
        || identity.address !== LOCAL_CATALOG_TARGET.host || identity.port !== Number(LOCAL_CATALOG_TARGET.port)
        || Number(identity.version) < 170000 || Number(identity.version) >= 180000)
      throw new Error('Local cluster identity mismatch; no bootstrap or migration permitted');
    await sql(`do $$ begin if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','phase2a_test') and c.relkind in ('r','p')) or to_regnamespace('auth') is not null or to_regnamespace('private') is not null or to_regnamespace('phase2a_test') is not null then raise exception 'EMPTY disposable database required';end if;end $$;`);
    await checked(['-1', '-f', guard, '-f', `${db}supabase-local-bootstrap.sql`]);
    const migrations = readdirSync(resolve(root, 'supabase/migrations')).filter(n => n.endsWith('.sql')).sort();
    const manifest = [];
    const preparations = [];
    for (const name of migrations) {
      const path = `supabase/migrations/${name}`;
      manifest.push({ name, sha256: createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex') });
      if (name === '20260819182058_future_foundation_physical_pick_order.sql') {
        const fixture = `${db}roy-phase-2a-historical-baseline.sql`;
        const evidence = { fixture, sha256: createHash('sha256').update(readFileSync(resolve(root, fixture))).digest('hex'),
          matrix: config.matrix, beforeMigration: name, migrationPosition: manifest.length };
        await file('roy-phase-2a-historical-baseline');
        preparations.push(evidence);
        // Retain completed preparation evidence even if a later migration fails.
        console.error(JSON.stringify({ event: 'acceptance-preparation-completed', ...evidence }));
      }
      if (config.matrix === 'upgrade' && name === '20260919093000_phase_2a_protected_backfill.sql') {
        const rejected = await psql(['-1', '-f', guard, '-f', path]);
        if (rejected.code === 0 || !/23514/.test(rejected.stderr) || !/shopify_product_content_category_valid/.test(rejected.stderr)) throw new Error('Expected exact category upgrade constraint rejection');
        await file('roy-phase-2a-upgrade-rejection');
      }
      await checked(['-1', '-f', guard, '-f', path]);
      if (config.matrix === 'upgrade' && name === '20260907195256_phase_2a_product_content_foundation.sql') await file('roy-phase-2a-upgrade-seed');
    }
    if (config.matrix === 'upgrade') await file('roy-phase-2a-upgrade-assertions');
    for (const suite of ['sync-persistence', 'catalog-foundation', 'targeted', 'backfill']) await file(`roy-phase-2a-${suite}.dynamic`);
    await file('catalog-identity.dynamic');
    await file('catalog-viper-sales.dynamic');
    await file('catalog-concurrency-setup');
    for (const scenario of ['inventory', 'inventory_insert', 'order', 'order_insert', 'pick', 'product_share']) {
      // Both sessions rendezvous using database-visible advisory barriers.
      // No sleep-based race assumptions, and no cleanup after a failing case.
      const writer = checked(['-f', guard, '-v', `scenario=${scenario}`, '-f', `${db}catalog-concurrency-writer.sql`], 'catalog-writer')
        .then(value => ({ value }), error => ({ error }));
      const completion = file('catalog-concurrency-completion', 'catalog-completion')
        .then(value => ({ value }), error => ({ error }));
      for (const result of await Promise.all([writer, completion])) if (result.error) throw result.error;
    }
    await file('catalog-concurrency-cleanup');
    await file('roy-phase-2a-recovery-setup');
    await overlap('roy-phase-2a-reclaim-page-session', 'phase2a-page', 1, 'roy-phase-2a-reclaim-session', 'phase2a-reclaim');
    await sql('update phase2a_test.recovery_state set before_state=phase2a_test.control_snapshot()');

    const interrupted = psql(['-f', guard, '-f', `${db}roy-phase-2a-ack-uncommitted.sql`], 'phase2a-ack-uncommitted');
    await barrier(2, 'phase2a-ack-uncommitted');
    await sql(`select pg_terminate_backend(a.pid) from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.datname=current_database() and a.application_name='phase2a-ack-uncommitted' and l.locktype='advisory' and l.classid=991 and l.objid=2 and l.objsubid=2 and l.granted`);
    if ((await interrupted).code === 0) throw new Error('Uncommitted session must be interrupted');
    await sql(`select phase2a_test.check(phase2a_test.control_snapshot()=before_state, 'disconnect rolled back every page/control side effect') from phase2a_test.recovery_state`);
    await sql(`select phase2a_test.check(public.recover_shopify_backfill_v1(op,rid,'RESUME '||op||' '||rid)->>'pagesProcessed'='0' and not exists(select 1 from private.shopify_backfill_pages) and not exists(select 1 from public.shopify_product_content), 'disconnected uncommitted page rolled back') from phase2a_test.recovery_state`);
    // Deliberately discard the successful committed RPC's output. Recovery below
    // runs in a NEW connection and must use only authoritative database state.
    await file('roy-phase-2a-ack-page');
    await file('roy-phase-2a-ack-recovery');
    await overlap('roy-phase-2a-completion-session-a', 'phase2a-completion-a', 3, 'roy-phase-2a-completion-session-b', 'phase2a-completion-b');
    await file('roy-phase-2a-completion-assertions');
    const exported = await checked(['-f', guard, '-v', 'operation=99000000-0000-4000-8000-000000000001',
      '-v', 'profile=96000000-0000-4000-8000-000000000001', '-f', 'scripts/roy-phase2a/proof-snapshot.sql']);
    const proof = acceptanceResult(JSON.parse(exported));
    return { matrix: config.matrix, database: config.database, manifest, preparations, proof, status: 'PASS' };
  } finally {
    for (const child of children) child.kill();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const config = options(process.argv.slice(2), process.env);
    console.log(config ? JSON.stringify(await execute(config), null, 2) : plan);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Acceptance failed');
    process.exitCode = 1;
  }
}
