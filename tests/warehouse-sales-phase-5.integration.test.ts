import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260729200811_warehouse_sales_phase_5_sync_reconciliation.sql";

test("reconciliation is location-specific and read-only", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /with \(security_invoker = true\)/i);
  assert.match(
    sql,
    /product\.shopify_inventory_location_id = job\.shopify_location_id/i
  );
  assert.doesNotMatch(sql, /update public\.inventory|insert into public\.inventory/i);
});

test("unobserved outbound deltas explain temporary differences", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /job\.status <> 'synced'/i);
  assert.match(
    sql,
    /job\.synced_at >= product\.shopify_inventory_observed_at/i
  );
  assert.match(sql, /'outbound_in_flight'/i);
  assert.match(sql, /'outbound_failed'/i);
  assert.match(sql, /'unexplained_difference'/i);
});

test("incoming catalog sync remains observation-only", async () => {
  const migration = await readFile(
    "supabase/migrations/20260729190854_warehouse_sales_phase_1_shopify_catalog.sql",
    "utf8"
  );
  const sync = await readFile("lib/shopify/sync-products.ts", "utf8");
  assert.match(migration, /shopify_inventory_observed_at = now\(\)/i);
  assert.match(migration, /shopify_inventory_location_id = variant_location_id/i);
  assert.doesNotMatch(`${migration}\n${sync}`, /update public\.inventory\s+set quantity/i);
});

test("dashboard counts only unexplained differences as quantity errors", async () => {
  const dashboard = await readFile("lib/dashboard.ts", "utf8");
  assert.match(dashboard, /warehouse_sale_shopify_reconciliation/);
  assert.match(
    dashboard,
    /reconciliation_status === "unexplained_difference"/
  );
});

test("phase 5 introduces no mandatory targeted Shopify reread", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(sql, /http|graphql|fetch/i);
});

