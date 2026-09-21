import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const control=read("supabase/migrations/20260919093000_phase_2a_protected_backfill.sql");
const oracle=read("supabase/migrations/20260919094000_phase_2a_backfill_proof.sql");
// Static contracts only: these tests do not prove PostgreSQL execution/locking.

test("configured fixture location supplies the complete unchanged production tuple",()=>{
  const helper=read("tests/database/roy-phase-2a-backfill.helpers.sql");
  assert.match(helper,/insert into public.shopify_connections\(shop,access_token,inventory_location_id,inventory_location_name,inventory_location_configured_at\)\s*values\('fixture.myshopify.com','offline-fixture-not-a-token','gid:\/\/shopify\/Location\/91001',\s*'Acceptance fixture location',TIMESTAMPTZ '2026-09-01 00:00:00\+00'\);/);
  assert.doesNotMatch(helper,/alter table|drop constraint|disable trigger|set role|on conflict/i);
  const schema=read("supabase/migrations/20260729190854_warehouse_sales_phase_1_shopify_catalog.sql");
  const constraint=schema.slice(schema.indexOf("add constraint shopify_connections_inventory_location_valid"),schema.indexOf("create or replace function public.apply_shopify_sync_page"));
  assert.match(constraint,/inventory_location_id is null\s+and inventory_location_name is null\s+and inventory_location_configured_at is null/);
  assert.ok(constraint.includes("inventory_location_id ~ '^gid://shopify/Location/[0-9]+$'"));
  assert.match(constraint,/and nullif\(btrim\(inventory_location_name\), ''\) is not null\s+and inventory_location_configured_at is not null/);
});

test("connection fixture inherits isolation guard before inserting synthetic data",()=>{
  const chain=["backfill","targeted","catalog-foundation","sync-persistence"];
  for(let i=0;i<chain.length-1;i++) {
    const helper=read(`tests/database/roy-phase-2a-${chain[i]}.helpers.sql`);
    const include=`\\ir roy-phase-2a-${chain[i+1]}.helpers.sql`;
    assert.ok(helper.startsWith("\\set ON_ERROR_STOP on"));
    assert.ok(helper.includes(include));
    const firstInsert=helper.indexOf("insert into");
    if(firstInsert>=0) assert.ok(helper.indexOf(include)<firstInsert);
  }
  const guard=read("tests/database/roy-phase-2a-sync-persistence.helpers.sql");
  assert.match(guard,/current_database\(\) !~ '\^snake_phase2a_test/);
  assert.match(guard,/current_setting\('snake.phase2a_isolated', true\) is distinct from 'on'/);
  assert.ok(guard.indexOf("raise exception")<guard.indexOf("create schema phase2a_test"));
});
test("protected writer delegates V2 once, atomically checks facts and inserts bounded receipt",()=>{
  const body=control.split("create function public.apply_shopify_backfill_page_v1")[1].split("create function public.complete_shopify_backfill_v1")[0];
  assert.equal([...body.matchAll(/result:=private.apply_shopify_sync_page_v2\(/g)].length,1);
  assert.ok(body.indexOf("for update")<body.indexOf("result:=private"));
  assert.ok(body.indexOf("insert into private.shopify_backfill_pages")>body.indexOf("result:=private"));
  assert.doesNotMatch(body,/exception when|commit;|rollback;|insert into public\./i);
  assert.match(control,/octet_length\(evidence::text\) <= 65536/);
  assert.match(body,/finalHasNextPage' is distinct from 'false'/);
});
test("ordinary signatures remain guarded; service role cannot execute moved cores",()=>{
  for(const fn of ["claim_shopify_sync_run","apply_shopify_sync_page","apply_shopify_sync_page_v2","complete_shopify_sync_run","pause_shopify_sync_run","fail_shopify_sync_run"])
    assert.match(control,new RegExp(`alter function public\\.${fn}\\([^;]+set schema private;`));
  assert.equal([...control.matchAll(/perform private.backfill_guard\(requested_run_id\)/g)].length,5);
  assert.match(control,/from public, anon, authenticated, service_role/);
  assert.match(control,/grant execute on function %s to service_role/);
  assert.doesNotMatch(control,/grant execute[^;]*to (?:anon|authenticated)/i);
  assert.match(control,/pg_advisory_xact_lock\(hashtextextended\('snake_shopify_sync'/);
});
test("admission forbids old checkpoint adoption and final completion requires unchanged approved preview",()=>{
  assert.match(control,/Existing resumable run blocks fresh admission/);
  assert.match(control,/Fresh run invariant failed/);
  assert.match(control,/Operation identity mismatch/);
  assert.match(control,/lock table public.products in share row exclusive mode/);
  assert.match(control,/preview is distinct from approved_preview/);
  assert.match(control,/Completion approval mismatch/);
  assert.match(control,/'completionHold',true/);
});
test("nullable category correction is forward and all ECMAScript whitespace is handled",()=>{
  assert.match(control,/\) is true\);/);
  const chars=[...control.matchAll(/\\([0-9A-F]{4})/g)].slice(0,25).map(m=>String.fromCharCode(parseInt(m[1],16)));
  assert.equal(new Set(chars).size,25);assert.ok(chars.every(c=>c.trim()===""));
  assert.doesNotMatch(control,/update public.shopify_product_content|delete from public.shopify_product_content/i);
});
test("oracle is bounded read-only and independent; export exercises caller RLS in the same snapshot",()=>{
  assert.match(oracle,/stable security definer set search_path=''/);
  assert.doesNotMatch(oracle,/public.get_roy_|\b(insert into|update public|delete from|truncate)\b/i);
  assert.match(oracle,/v.active=true and v.shopify_product_id is not null/);
  assert.match(oracle,/limit 8/);assert.match(oracle,/octet_length\(result::text\)>65536/);
  for(const name of ["contentMismatches","collectionMismatches","variantMismatches","counterAgreement","reconciliationAgreement","sourceEvidenceValid"]) assert.ok(oracle.includes(`'${name}'`));
  const sql=read("scripts/roy-phase2a/proof-snapshot.sql");
  assert.match(sql,/begin isolation level repeatable read read only/);assert.match(sql,/set local role authenticated/);
  assert.ok(sql.indexOf("get_shopify_backfill_proof_facts_v1")<sql.indexOf("set local role authenticated"));
  assert.doesNotMatch(sql,/security definer|set local role service_role|commit;/i);
});
test("executable fixtures have isolation guard chains and rollback, including receipt fault and races",()=>{
  const sql=read("tests/database/roy-phase-2a-backfill.dynamic.sql");
  assert.match(sql,/\\ir roy-phase-2a-backfill.helpers.sql/);assert.match(sql,/rollback;/);
  assert.match(sql,/private.shopify_backfill_pages/);assert.match(sql,/preview changed/);assert.match(sql,/checkpoint conflict/);
  assert.match(read("tests/database/roy-phase-2a-backfill.helpers.sql"),/\\ir roy-phase-2a-targeted.helpers.sql/);
  assert.match(read("tests/database/roy-phase-2a-sync-persistence.helpers.sql"),/snake.phase2a_isolated/);
  for(const suffix of ["concurrent-call","concurrency-assertions"]) assert.match(read(`tests/database/roy-phase-2a-backfill-${suffix}.sql`),/snake.phase2a_isolated/);
});
