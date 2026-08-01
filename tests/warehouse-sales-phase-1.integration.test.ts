import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260729190854_warehouse_sales_phase_1_shopify_catalog.sql",
  import.meta.url
);

async function migrationSql() {
  return readFile(migrationUrl, "utf8");
}

test("phase 1 stores price and one explicit Shopify inventory location", async () => {
  const sql = await migrationSql();

  assert.match(sql, /add column shopify_price_minor bigint/i);
  assert.match(sql, /add column inventory_location_id text/i);
  assert.match(sql, /shopify_inventory_location_id/i);
  assert.match(sql, /shopify_inventory_level_id/i);
});

test("incoming Shopify sync records observations without writing Snake inventory", async () => {
  const sql = await migrationSql();
  const functionStart = sql.indexOf(
    "create or replace function public.apply_shopify_sync_page"
  );
  const functionEnd = sql.indexOf("$$;", functionStart);
  const functionBody = sql.slice(functionStart, functionEnd);

  assert.match(functionBody, /shopify_price_minor/i);
  assert.match(functionBody, /shopify_inventory_observed_at/i);
  assert.match(functionBody, /shopify_quantity/i);
  assert.doesNotMatch(functionBody, /update\s+public\.inventory\b/i);
  assert.doesNotMatch(functionBody, /insert\s+into\s+public\.inventory\b/i);
  assert.doesNotMatch(functionBody, /delete\s+from\s+public\.inventory\b/i);
});

test("replacement sync RPC remains service-role-only", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /revoke all on function public\.apply_shopify_sync_page[\s\S]*from public, anon, authenticated/i
  );
  assert.match(
    sql,
    /grant execute on function public\.apply_shopify_sync_page[\s\S]*to service_role/i
  );
});
