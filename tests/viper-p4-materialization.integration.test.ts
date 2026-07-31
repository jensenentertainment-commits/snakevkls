import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260731182734_viper_p4_2_shopify_materialization.sql",
  import.meta.url
);

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function migrationSql() {
  return readFile(migrationUrl, "utf8");
}

test("P4.2 exposes one service-only security-invoker materialization RPC", async () => {
  const sql = await migrationSql();
  assert.match(sql, /create or replace function public\.materialize_viper_shopify_order\(/i);
  assert.match(sql, /language plpgsql[\s\S]*security invoker/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /from public, anon, authenticated/i);
  assert.match(sql, /to service_role/i);
  assert.doesNotMatch(sql, /security definer/i);
});

test("P4.2 validates every exact variant target before persistent writes", async () => {
  const sql = await migrationSql();
  const variantLookup = sql.indexOf("where shopify_variant_id = variant_id");
  const prepared = sql.indexOf("prepared_lines := prepared_lines");
  const firstInsert = sql.indexOf("insert into public.orders");
  assert.ok(variantLookup > 0);
  assert.ok(prepared > variantLookup);
  assert.ok(firstInsert > prepared);
  assert.match(sql, /Shopify and Snake SKU mismatch/i);
  assert.match(sql, /Insufficient physical inventory/i);
  assert.match(sql, /pick location is ambiguous/i);
  assert.doesNotMatch(sql, /where sku = line_sku/i);
});

test("P4.2 creates the complete ready-to-pick graph and audit trail atomically", async () => {
  const sql = await migrationSql();
  for (const fragment of [
    "insert into public.orders",
    "insert into public.order_lines",
    "insert into public.pick_jobs",
    "insert into public.pick_lines",
    "'order_imported'",
    "'pick_job_created'",
    "insert into public.activity_log",
  ]) {
    assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(sql, /'ready_to_pick'/);
  assert.match(sql, /'ready'/);
  assert.doesNotMatch(sql, /\bcommit\b|\brollback\b/i);
  assert.doesNotMatch(sql, /delete from public\.(orders|order_lines|pick_jobs|pick_lines)/i);
});

test("P4.2 import refetches Shopify and delegates exactly one database mutation", async () => {
  const route = await source("app/api/viper/shopify/orders/import/route.ts");
  const service = await source("lib/viper/shopify/order-materialization.ts");
  assert.match(route, /requireViperAdminApiActor\(\)/);
  assert.match(service, /fetchShopifyOrderForPreview\(orderId\)/);
  assert.match(service, /order\.updatedAt !== previewUpdatedAt/);
  assert.match(service, /previewFetchedShopifyOrder\(order\)/);
  assert.match(service, /\.rpc\(\s*"materialize_viper_shopify_order"/);
  assert.doesNotMatch(`${route}\n${service}`, /\.(insert|upsert|update|delete)\(/);
  assert.doesNotMatch(`${route}\n${service}`, /mutation\s+/i);
});

test("P4.2 UI imports only an approved preview and routes into the existing queue domain", async () => {
  const form = await source("app/components/viper/ShopifyOrderPreviewForm.tsx");
  const queue = await source("lib/viper/orders/repository.ts");
  assert.match(form, /preview\.importable/);
  assert.match(form, /previewUpdatedAt: preview\.order\.updatedAt/);
  assert.match(form, /\/api\/viper\/shopify\/orders\/import/);
  assert.match(form, /router\.push\(`\/viper\/orders\//);
  assert.match(queue, /status\.eq\.ready/);
});
