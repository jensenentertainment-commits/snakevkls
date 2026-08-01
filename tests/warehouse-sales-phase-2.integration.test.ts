import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260729192236_warehouse_sales_phase_2_domain_outbox.sql",
  import.meta.url
);

async function migrationSql() {
  return readFile(migrationUrl, "utf8");
}

test("phase 2 creates only the sale, line and transactional outbox tables", async () => {
  const sql = await migrationSql();
  const tables = Array.from(
    sql.matchAll(/create table public\.([a-z0-9_]+)/gi),
    (match) => match[1]
  );

  assert.deepEqual(tables, [
    "warehouse_sales",
    "warehouse_sale_lines",
    "warehouse_sale_shopify_sync_jobs",
  ]);
  assert.doesNotMatch(sql, /create table public\.(customers|receipts|returns)/i);
});

test("completed sale identity and monetary summaries are constrained", async () => {
  const sql = await migrationSql();

  assert.match(sql, /sale_number text not null unique/i);
  assert.match(sql, /status text not null default 'completed'/i);
  assert.match(sql, /payment_method ~ '\^\[a-z\]\[a-z0-9_\]\*\$'/i);
  assert.match(sql, /total_amount_minor bigint not null/i);
  assert.match(sql, /total_amount_minor >= 0/i);
  assert.match(sql, /idempotency_key uuid not null unique/i);
  assert.match(sql, /request_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(sql, /warehouse_sales_immutable/i);
});

test("sale lines preserve snapshots and calculate totals in whole øre", async () => {
  const sql = await migrationSql();

  assert.match(sql, /standard_unit_price_minor bigint not null/i);
  assert.match(sql, /unit_price_minor bigint not null/i);
  assert.match(
    sql,
    /line_total_minor bigint generated always as \([\s\S]*unit_price_minor \* quantity::bigint/i
  );
  assert.match(
    sql,
    /price_overridden boolean generated always as \([\s\S]*unit_price_minor <> standard_unit_price_minor/i
  );
  assert.match(sql, /unique \(sale_id, product_id\)/i);
  assert.match(sql, /warehouse_sale_lines_immutable/i);
});

test("outbox enforces one immutable Shopify operation identity per sale", async () => {
  const sql = await migrationSql();

  assert.match(sql, /warehouse_sale_id uuid not null unique/i);
  assert.match(sql, /unique \(shop, idempotency_key\)/i);
  assert.match(sql, /payload @> '\{"schemaVersion": 1\}'::jsonb/i);
  assert.match(sql, /payload ->> 'locationId' = shopify_location_id/i);
  assert.match(sql, /jsonb_array_length\(payload -> 'changes'\) > 0/i);
  assert.match(
    sql,
    /protect_warehouse_sale_shopify_job_identity[\s\S]*new\.payload is distinct from old\.payload/i
  );
  assert.match(
    sql,
    /new\.idempotency_key is distinct from old\.idempotency_key/i
  );
});

test("outbox states require coherent lease, retry, success and error fields", async () => {
  const sql = await migrationSql();

  for (const status of ["pending", "processing", "synced", "failed"]) {
    assert.match(sql, new RegExp(`status = '${status}'`, "i"));
  }

  assert.match(sql, /num_nonnulls\(lease_token, lease_expires_at\) in \(0, 2\)/i);
  assert.match(sql, /status = 'processing'[\s\S]*attempt_count > 0/i);
  assert.match(sql, /status = 'synced'[\s\S]*synced_at is not null/i);
  assert.match(
    sql,
    /status = 'failed'[\s\S]*nullif\(btrim\(last_error_message\), ''\) is not null/i
  );
  assert.match(sql, /where status in \('pending', 'failed'\)/i);
  assert.match(sql, /where status = 'processing'/i);
});

test("warehouse-sale stock movements must reference a line from the same sale", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /foreign key \(warehouse_sale_id, warehouse_sale_line_id\)[\s\S]*references public\.warehouse_sale_lines\(sale_id, id\)/i
  );
  assert.match(
    sql,
    /reason = 'warehouse_sale'[\s\S]*warehouse_sale_id is not null[\s\S]*warehouse_sale_line_id is not null/i
  );
  assert.match(sql, /'viper_pick', 'warehouse_sale'/i);
});

test("active users have read-only Data API access and service role owns writes", async () => {
  const sql = await migrationSql();

  for (const table of [
    "warehouse_sales",
    "warehouse_sale_lines",
    "warehouse_sale_shopify_sync_jobs",
  ]) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table}[\\s\\S]*enable row level security`, "i")
    );
  }

  assert.match(
    sql,
    /using \(\(select private\.has_role\(array\['admin', 'lager'\]::text\[\]\)\)\)/i
  );
  assert.match(
    sql,
    /grant select on table[\s\S]*warehouse_sale_shopify_sync_jobs[\s\S]*to authenticated/i
  );
  assert.doesNotMatch(sql, /grant (insert|update|delete)[\s\S]*to authenticated/i);
  assert.match(
    sql,
    /grant all privileges on table[\s\S]*warehouse_sale_shopify_sync_jobs[\s\S]*to service_role/i
  );
});

test("phase 2 introduces no completion RPC, inventory update or Shopify call", async () => {
  const sql = await migrationSql();

  assert.doesNotMatch(sql, /create or replace function public\.complete_warehouse_sale/i);
  assert.doesNotMatch(sql, /update\s+public\.inventory\b/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.stock_movements\b/i);
  assert.doesNotMatch(sql, /http|graphql|inventoryAdjustQuantities/i);
});
