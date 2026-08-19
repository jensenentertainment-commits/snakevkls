import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260729193103_warehouse_sales_phase_3_atomic_completion.sql",
  import.meta.url
);

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function migrationSql() {
  return readFile(migrationUrl, "utf8");
}

test("phase 3 exposes one service-only security-invoker completion RPC", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /create or replace function public\.complete_warehouse_sale\(/i
  );
  assert.match(sql, /language plpgsql[\s\S]*security invoker/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(
    sql,
    /revoke all on function public\.complete_warehouse_sale\([\s\S]*from public, anon, authenticated/i
  );
  assert.match(
    sql,
    /grant execute on function public\.complete_warehouse_sale\([\s\S]*to service_role/i
  );
  assert.doesNotMatch(sql, /security definer/i);
});

test("local idempotency serializes matching keys and rejects changed requests", async () => {
  const sql = await migrationSql();
  const advisoryLock = sql.indexOf("pg_advisory_xact_lock");
  const existingLookup = sql.indexOf("from public.warehouse_sales", advisoryLock);
  const firstSaleInsert = sql.indexOf("insert into public.warehouse_sales");

  assert.ok(advisoryLock > 0);
  assert.ok(existingLookup > advisoryLock);
  assert.ok(firstSaleInsert > existingLookup);
  assert.match(sql, /where idempotency_key = requested_idempotency_key/i);
  assert.match(
    sql,
    /existing_sale\.request_hash <> requested_request_hash/i
  );
  assert.match(sql, /idempotency key reuse conflict/i);
  assert.match(sql, /'idempotentReplay', true/i);
  assert.match(sql, /'idempotentReplay', false/i);
});

test("all products and inventory rows are locked in stable order before writes", async () => {
  const sql = await migrationSql();
  const productLock = sql.indexOf("order by product.id");
  const inventoryLock = sql.indexOf("order by inventory.id");
  const stockValidation = sql.indexOf(
    "Insufficient inventory for warehouse sale product"
  );
  const saleInsert = sql.indexOf("insert into public.warehouse_sales");

  assert.ok(productLock > 0);
  assert.ok(inventoryLock > productLock);
  assert.ok(stockValidation > inventoryLock);
  assert.ok(saleInsert > stockValidation);
  assert.match(
    sql,
    /from public\.inventory as inventory[\s\S]*order by inventory\.id[\s\S]*for update/i
  );
});

test("allocation uses primary location first and never allows negative stock", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /order by[\s\S]*inventory\.is_primary desc,[\s\S]*inventory\.created_at,[\s\S]*inventory\.id/i
  );
  assert.match(
    sql,
    /deduct_quantity :=[\s\S]*least\(remaining_quantity, inventory_row\.quantity\)/i
  );
  assert.match(
    sql,
    /set quantity = quantity - deduct_quantity/i
  );
  assert.match(sql, /if remaining_quantity <> 0 then/i);
});

test("sale, snapshots, movements, activity and one pending outbox job share the RPC", async () => {
  const sql = await migrationSql();

  const saleInsert = sql.indexOf("insert into public.warehouse_sales");
  const lineInsert = sql.indexOf("insert into public.warehouse_sale_lines");
  const inventoryUpdate = sql.indexOf("update public.inventory");
  const movementInsert = sql.indexOf("insert into public.stock_movements");
  const jobInsert = sql.indexOf(
    "insert into public.warehouse_sale_shopify_sync_jobs"
  );
  const activityInsert = sql.indexOf("insert into public.activity_log");

  assert.ok(saleInsert > 0);
  assert.ok(lineInsert > saleInsert);
  assert.ok(inventoryUpdate > lineInsert);
  assert.ok(movementInsert > inventoryUpdate);
  assert.ok(jobInsert > movementInsert);
  assert.ok(activityInsert > jobInsert);
  assert.match(sql, /'pending',[\s\S]*outbox_idempotency_key/i);
  assert.doesNotMatch(sql, /exception\s+when/i);
});

test("outbox payload contains immutable negative product deltas", async () => {
  const sql = await migrationSql();

  assert.match(sql, /'schemaVersion', 1/i);
  assert.match(sql, /'locationId', connection_row\.inventory_location_id/i);
  assert.match(sql, /'saleLineId', warehouse_line\.id/i);
  assert.match(sql, /'inventoryItemId', product\.shopify_inventory_item_id/i);
  assert.match(sql, /'delta', -warehouse_line\.quantity/i);
  assert.match(sql, /'snake:\/\/warehouse-sale\/' \|\| sale_id::text/i);
});

test("validation failures occur without local partial-write recovery logic", async () => {
  const sql = await migrationSql();

  for (const scenario of [
    "unknown product",
    "not sellable",
    "Insufficient inventory",
    "allocation failed",
    "missing write_inventory",
  ]) {
    assert.match(sql, new RegExp(scenario, "i"));
  }

  assert.doesNotMatch(sql, /\bcommit\b|\brollback\b/i);
  assert.doesNotMatch(sql, /delete from public\.warehouse_sales/i);
  assert.doesNotMatch(sql, /quantity = quantity \+ deduct_quantity/i);
});

test("completion API authorizes, normalizes and delegates exactly once", async () => {
  const route = await source("app/api/warehouse-sales/complete/route.ts");
  const completion = await source("lib/warehouse-sales/completion.ts");

  assert.match(route, /requireRole\(\["admin", "user"\]\)/);
  assert.match(route, /normalizeWarehouseSaleRequest/);
  assert.match(route, /completeWarehouseSale/);
  assert.match(completion, /\.rpc\(\s*"complete_warehouse_sale"/);
  assert.doesNotMatch(`${route}\n${completion}`, /fetch\(|inventoryAdjustQuantities/);
  assert.doesNotMatch(
    `${route}\n${completion}`,
    /\.(insert|update|delete)\(/
  );
});
