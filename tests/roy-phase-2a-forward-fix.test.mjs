import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { options, acceptanceResult } from '../scripts/roy-phase2a/database-acceptance.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const args = ['--execute', '--matrix', 'fresh', '--database', 'snake_phase2a_test_fresh', '--confirm', 'EXECUTE ISOLATED fresh snake_phase2a_test_fresh'];
const env = { PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'snake_phase2a_test_fresh', PGUSER: 'isolated_owner' };

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
