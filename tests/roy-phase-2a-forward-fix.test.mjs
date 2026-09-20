import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { options, acceptanceResult } from '../scripts/roy-phase2a/database-acceptance.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const args = ['--execute', '--matrix', 'fresh', '--database', 'snake_phase2a_test_fresh', '--confirm', 'EXECUTE ISOLATED fresh snake_phase2a_test_fresh'];
const env = { PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'snake_phase2a_test_fresh', PGUSER: 'isolated_owner' };

test('approved historical migration chain remains byte-equivalent apart from checkout line endings', () => {
  const hash = createHash('sha256');
  const names = readdirSync(new URL('../supabase/migrations/', import.meta.url))
    .filter(n => n.endsWith('.sql') && n <= '20260920120000_phase_2a_protected_claim_lock_order.sql').sort();
  assert.equal(names.length, 29);
  for (const name of names) {
    hash.update(name + '\n');
    hash.update(read(`supabase/migrations/${name}`).replace(/\r\n/g, '\n'));
  }
  // Approved revision 63df47477be8fa6b272a17d4f4b1c836d6541e27.
  assert.equal(hash.digest('hex'), '38e62c5f73ef72fa9536b5d0436b82145a59c68b7d9c38af5e1737f838b3b7d3');
});

test('historical baseline is guarded, atomic, empty-only and exactly three synthetic zones', () => {
  const sql = read('tests/database/roy-phase-2a-historical-baseline.sql');
  assert.ok(sql.startsWith('\\ir roy-phase-2a-acceptance.guard.sql'));
  assert.match(sql, /begin;[\s\S]*lock table public.zones in exclusive mode;[\s\S]*if exists \(select 1 from public.zones\) then[\s\S]*raise exception/);
  assert.ok(sql.indexOf('raise exception') < sql.indexOf('insert into'));
  assert.match(sql, /insert into public.zones \(code, name, active\) values/);
  assert.deepEqual([...sql.matchAll(/\('([^']+)', '([^']+)', true\)/g)].map(m => [m[1], m[2]]),
    [['HL', 'Acceptance fixture HL'], ['ML', 'Acceptance fixture ML'], ['SL', 'Acceptance fixture SL']]);
  assert.equal((sql.match(/insert into/gi) ?? []).length, 1);
  assert.doesNotMatch(sql, /on conflict|pick_priority|public.locations|update public|delete from|alter table|exception when/i);
  assert.match(sql, /commit;\s*$/);
});

test('both matrices prepare baseline immediately before priority migration and retain evidence', () => {
  const source = read('scripts/roy-phase2a/database-acceptance.mjs');
  const start = source.indexOf("if (name === '20260819182058_future_foundation_physical_pick_order.sql')");
  const end = source.indexOf("if (config.matrix === 'upgrade'", start);
  assert.ok(start > source.indexOf('for (const name of migrations)'));
  assert.ok(end > start);
  const block = source.slice(start, end);
  assert.match(block, /await file\('roy-phase-2a-historical-baseline'\)/);
  assert.doesNotMatch(block, /config.matrix ===/);
  assert.match(block, /sha256: createHash\('sha256'\)/);
  assert.match(block, /beforeMigration: name, migrationPosition: manifest.length/);
  assert.match(block, /console.error\(JSON.stringify/);
  assert.match(source, /manifest, preparations, proof/);
  for (const matrix of ['fresh', 'upgrade']) {
    assert.equal(options(args.map(a => a.replaceAll('fresh', matrix)), { ...env, PGDATABASE: `snake_phase2a_test_${matrix}` }).matrix, matrix);
  }
  assert.ok(end < source.indexOf("await checked(['-1', '-f', guard, '-f', path]);", end));
});

test('persistence synthetic zone supplies its own unused positive priority', () => {
  assert.match(read('tests/database/roy-phase-2a-sync-persistence.dynamic.sql'),
    /insert into public.zones \(id, code, name, pick_priority\) values \('91000000-0000-4000-8000-000000000010', 'P2A', 'Fixture', 100\)/);
  const historical = read('supabase/migrations/20260819182058_future_foundation_physical_pick_order.sql');
  assert.deepEqual([...historical.matchAll(/when '[A-Z]+' then (\d+)/g)].map(m => Number(m[1])), [1, 2, 3, 4]);
});

test('acceptance default is offline even with invalid database environment', () => {
  assert.equal(options([], {}), null);
  assert.equal(options(['--plan'], { PGHOST: 'production' }), null);
  const result = spawnSync(process.execPath, ['scripts/roy-phase2a/database-acceptance.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.match(result.stdout, /Prepared, NOT RUN/);
});
test('acceptance requires exact explicit target, matrix and approval', () => {
  assert.equal(options(args, env).matrix, 'fresh');
  for (const changed of [[], ['--execute'], [...args, '--execute'], [...args, '--url', 'production'], args.slice(0, -2), args.map(a => a === 'fresh' ? 'production' : a)]) {
    if (changed.length) assert.throws(() => options(changed, env));
  }
  for (const patch of [{ PGDATABASE: 'postgres' }, { PGHOST: 'production.supabase.co' }, { PGHOST: '' }, { PGPORT: '99999' },
    { PGSERVICE: 'prod' }, { PGSERVICEFILE: 'prod' }, { PGHOSTADDR: '1.2.3.4' }]) assert.throws(() => options(args, { ...env, ...patch }));
  assert.throws(() => options(args.map(a => a.replaceAll('snake_phase2a_test_fresh', 'TV19')), { ...env, PGDATABASE: 'TV19' }));
});
test('connection options cannot silently redirect target or remove isolation', () => {
  const parsed = options(args, { ...env, PGOPTIONS: '-c snake.phase2a_isolated=off', PGAPPNAME: 'prod', PGPASSWORD: 'fixture-secret' });
  assert.match(parsed.childEnv.PGOPTIONS, /snake.phase2a_isolated=on/);
  assert.equal(parsed.childEnv.PGAPPNAME, undefined);
  assert.equal(parsed.childEnv.PGPASSWORD, 'fixture-secret');
  assert.equal(env.PGOPTIONS, undefined);
});
test('malformed proof cannot pass the actual-export acceptance boundary', () => {
  assert.throws(() => acceptanceResult({}));
  assert.throws(() => acceptanceResult('x'.repeat(512 * 1024)));
});
test('forward migration preserves claim API, lock order and service-only grants', () => {
  const sql = read('supabase/migrations/20260920120000_phase_2a_protected_claim_lock_order.sql');
  assert.match(sql, /create or replace function public.claim_shopify_backfill_v1\(requested_operation uuid, requested_run_id uuid, confirmation text\)/);
  assert.match(sql, /security definer set search_path = ''/);
  const op = sql.indexOf('from private.shopify_backfill_operations');
  assert.ok(sql.indexOf('pg_advisory_xact_lock') < op);
  assert.ok(op < sql.indexOf('for update'));
  assert.ok(sql.indexOf('for update') < sql.indexOf('private.claim_shopify_sync_run('));
  assert.match(sql, /operation_id=requested_operation and run_id=requested_run_id for update/);
  assert.match(sql, /if not found then raise exception/);
  assert.match(sql, /'completionHold',true/);
  assert.match(sql, /revoke all[^;]+from public,anon,authenticated,service_role/);
  assert.match(sql, /grant execute[^;]+to service_role/);
  assert.doesNotMatch(sql, /insert into|delete from|apply_shopify_sync_page|exception when/i);
});
test('category constraint and defensive reader cases are isolated, with precise SQLSTATEs', () => {
  const sql = read('tests/database/roy-phase-2a-catalog-foundation.dynamic.sql');
  assert.match(sql, /exception when check_violation then/);
  assert.match(sql, /get stacked diagnostics rejected_constraint = constraint_name/);
  assert.match(sql, /rejected_constraint='shopify_product_content_category_valid'/);
  const reader = sql.slice(sql.indexOf('-- Defensive reader test only:'), sql.indexOf("'nonfinite observations fail closed'"));
  assert.match(reader, /drop constraint shopify_product_content_category_valid/);
  assert.match(reader, /exception when sqlstate '22000'/);
  assert.match(reader, /reader isolation restored category constraint/);
  assert.doesNotMatch(reader, /exception when others/);
});
test('concurrency regression waits for actual blocking then proves run lock is free', () => {
  const sql = read('tests/database/roy-phase-2a-reclaim-page-session.sql');
  assert.ok(sql.indexOf('shopify_backfill_operations') < sql.indexOf('wait_for_blocked'));
  assert.ok(sql.indexOf('wait_for_blocked') < sql.indexOf('for update nowait'));
  assert.match(sql, /lease is not valid/);
  assert.match(read('tests/database/roy-phase-2a-recovery-setup.sql'), /pg_blocking_pids/);
  const b = read('tests/database/roy-phase-2a-completion-session-b.sql');
  assert.doesNotMatch(b, /^update phase2a_test/m);
  assert.match(b, /public.complete_shopify_backfill_v1/);
});
test('all new SQL entry points guard before fixture mutations', () => {
  const suffixes = ['recovery-setup', 'reclaim-page-session', 'reclaim-session', 'ack-page', 'ack-uncommitted', 'ack-recovery',
    'completion-session-a', 'completion-session-b', 'completion-assertions', 'upgrade-seed', 'upgrade-rejection', 'upgrade-assertions'];
  for (const suffix of suffixes) assert.ok(read(`tests/database/roy-phase-2a-${suffix}.sql`).startsWith('\\ir roy-phase-2a-acceptance.guard.sql'));
  assert.match(read('tests/database/roy-phase-2a-acceptance.guard.sql'), /current_database\(\).*snake_phase2a_test/);
});
test('matrix includes real rejection, migration order, rollback/recovery and production export/evaluator', () => {
  const sql = read('scripts/roy-phase2a/database-acceptance.mjs');
  assert.match(sql, /filter\(n => n.endsWith\('\.sql'\)\).sort\(\)/);
  assert.match(sql, /23514/); assert.match(sql, /shopify_product_content_category_valid/);
  assert.match(sql, /pg_terminate_backend/); assert.match(sql, /a.datname=current_database\(\)/);
  assert.match(sql, /scripts\/roy-phase2a\/proof-snapshot.sql/);
  assert.match(sql, /acceptanceResult\(JSON.parse\(exported\)\)/);
  assert.doesNotMatch(sql, /create database|docker|supabase branch|shell: true/i);
  for (const filename of readdirSync(new URL('../supabase/migrations/', import.meta.url))) {
    if (filename.endsWith('.sql')) assert.doesNotMatch(read(`supabase/migrations/${filename}`), /^\s*(begin|commit|rollback)\s*;/im, 'migration runner owns transaction');
  }
});
