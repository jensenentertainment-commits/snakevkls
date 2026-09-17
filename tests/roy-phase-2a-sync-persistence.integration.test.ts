import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = "supabase/migrations/20260917192405_phase_2a_transactional_sync_persistence.sql";

// Static contracts only. These assertions DO NOT execute PostgreSQL or prove
// transactional correctness; tests/database contains the separate runtime suite.
test("v2 has one nested legacy write, run fencing, and no swallowed SQL exceptions", async () => {
  const sql = await read(migration);
  const body = sql.slice(sql.indexOf("create function public.apply_shopify_sync_page_v2"), sql.indexOf("revoke all"));
  assert.match(body, /from private\.sync_runs\s+where id = requested_run_id\s+for update/);
  assert.match(body, /current_run\.cursor is distinct from expected_cursor/);
  assert.match(body, /current_run\.pages_processed is distinct from expected_pages_processed/);
  assert.match(body, /current_run\.has_next_page is not true/);
  assert.match(body, /current_run\.lease_token is distinct from requested_lease_token/);
  assert.match(body, /requested_lease_token is null/);
  assert.match(body, /lease_expires_at <= clock_timestamp\(\)/);
  assert.equal([...body.matchAll(/public\.apply_shopify_sync_page\(/g)].length, 1);
  assert.doesNotMatch(body, /exception\s+when|\bcommit\s*;|\brollback\s*;|\bexecute\s+/i);
  assert.ok(body.indexOf("Only complete Shopify collection") < body.indexOf("insert into public.shopify_product_content"));
  assert.ok(body.indexOf("applied_page := public.apply_shopify_sync_page") > body.indexOf("collections_complete = true"));
  assert.ok(body.lastIndexOf("lease_expires_at <= clock_timestamp()") > body.indexOf("applied_page :="));
});

test("canonical writes replace explicit missing values and completed membership by stable ID", async () => {
  const sql = await read(migration);
  assert.match(sql, /on conflict \(shopify_product_id\) do update/);
  for (const field of ["description", "seo_title", "seo_description", "product_type", "vendor", "image_url", "shopify_category_id", "shopify_category_full_name", "shopify_updated_at", "content_observed_at"]) {
    assert.ok(sql.includes(`${field} = excluded.${field}`), `${field} must overwrite explicit missing values`);
  }
  assert.match(sql, /\(content ->> 'shopifyUpdatedAt'\)::timestamptz/);
  assert.match(sql, /\(content ->> 'contentObservedAt'\)::timestamptz, clock_timestamp\(\)/);
  assert.match(sql, /delete from public\.shopify_product_collections as membership\s+where membership\.shopify_product_id = product_id/);
  assert.match(sql, /from jsonb_array_elements\(observation -> 'collections'\)/);
  assert.match(sql, /collections_complete = true,\s+collections_observed_at = \(observation ->> 'observedAt'\)::timestamptz/);
  assert.doesNotMatch(sql, /collections_complete\s*=\s*false/);
  assert.match(sql, /group by item\.value ->> 'id' having count\(\*\) > 1/);
  assert.match(sql, /Legacy and canonical Shopify collection membership disagree/);
  assert.match(sql, /content \?& array/);
});

test("forward migration changes the handle index without changing historical migrations or legacy writer", async () => {
  const sql = await read(migration);
  assert.match(sql, /drop index public\.shopify_product_content_handle_key;/);
  assert.match(sql, /create index shopify_product_content_handle_idx\s+on public\.shopify_product_content \(product_handle\)/);
  assert.doesNotMatch(sql, /create unique index|create (?:or replace )?function public\.apply_shopify_sync_page\(/i);
  assert.match(await read("supabase/migrations/20260907195256_phase_2a_product_content_foundation.sql"), /create unique index shopify_product_content_handle_key/);
  assert.doesNotMatch(sql, /(?:insert into|update|delete from|alter table) public\.(?:products|product_collections|inventory|warehouse_sales|viper_\w+)\b/);
});

test("claim changes only add persisted hasNextPage to both existing response branches", async () => {
  const old = await read("supabase/migrations/20260721171117_phase_2_shopify_sync.sql");
  const sql = await read(migration);
  const extract = (text: string) => text.slice(text.indexOf("create or replace function public.claim_shopify_sync_run("))
    .split("$$;")[0].replace(/\r/g, "");
  const replacement = extract(sql);
  assert.equal([...replacement.matchAll(/'hasNextPage', current_run.has_next_page,/g)].length, 2);
  assert.equal(replacement.replace(/^\s*'hasNextPage', current_run.has_next_page,\n/gm, ""), extract(old));
});

test("v2 RPC is service-only with hardened search path and no changed RLS", async () => {
  const sql = await read(migration);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /revoke all on function public\.apply_shopify_sync_page_v2\(\s*uuid, uuid, text, integer, text, boolean, jsonb, jsonb, integer\s*\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.apply_shopify_sync_page_v2\([\s\S]*?\) to service_role;/);
  assert.doesNotMatch(sql, /create policy|disable row level security|grant .* to (?:anon|authenticated)/i);
});

test("application sends one normalized page RPC and reads the specific authoritative run", async () => {
  const source = await read("lib/shopify/sync-products.ts");
  assert.match(source, /prepareShopifyPersistencePage\(page\.variants\)/);
  assert.match(source, /"apply_shopify_sync_page_v2"/);
  assert.match(source, /expected_pages_processed: expectedPagesProcessed/);
  assert.match(source, /page_products: payload\.products/);
  assert.match(source, /page_variants: payload\.variants/);
  assert.match(source, /async readRun\(runId\)[\s\S]*?"get_shopify_sync_run",\s*{\s*requested_run_id: runId/);
  assert.doesNotMatch(source, /\.from\("(?:shopify_product_content|shopify_product_collections|products|product_collections)"\)/);
  assert.doesNotMatch(source, /"apply_shopify_sync_page"/);
});

test("executable SQL fixtures are isolated-only and are not presented as executed tests", async () => {
  const helper = await read("tests/database/roy-phase-2a-sync-persistence.helpers.sql");
  assert.match(helper, /current_database\(\) !~ '\^snake_phase2a_test/);
  assert.ok(helper.indexOf("Isolated snake_phase2a_test") < helper.indexOf("create schema"));
  const dynamic = await read("tests/database/roy-phase-2a-sync-persistence.dynamic.sql");
  assert.match(dynamic, /\\ir roy-phase-2a-sync-persistence.helpers.sql/);
  assert.match(dynamic, /rollback;/);
  assert.match(dynamic, /set local role service_role/);
  assert.match(dynamic, /when insufficient_privilege/);
  const docs = await read("docs/roy-phase-2a-transactional-sync-persistence.md");
  assert.match(docs, /NOT RUN — isolated database target unavailable/);
});
