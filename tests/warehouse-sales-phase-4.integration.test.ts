import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260729195841_warehouse_sales_phase_4_shopify_worker.sql";

test("claim is atomic, non-blocking and reclaims only expired leases", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /status = 'processing'/i);
  assert.match(sql, /attempt_count = attempt_count \+ 1/i);
  assert.match(sql, /lease_expires_at <= now\(\)/i);
  assert.match(sql, /requested_lease_seconds < 15/i);
});

test("worker transitions require the exact live lease", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /lease_token = requested_lease_token[\s\S]*lease_expires_at > now\(\)/i);
  assert.match(sql, /raise exception 'Warehouse sale Shopify lease is not valid'/i);
});

test("claim never regenerates immutable Shopify operation identity", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const update = sql.match(
    /update public\.warehouse_sale_shopify_sync_jobs[\s\S]*?returning \* into claimed;/i
  )?.[0] ?? "";
  assert.doesNotMatch(
    update,
    /payload\s*=|payload_hash\s*=|shopify_location_id\s*=|idempotency_key\s*=|reference_document_uri\s*=/
  );
});

test("failure transition separates scheduled and manual retry", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /requested_retry_delay_seconds is null then null/i);
  assert.match(sql, /status = 'failed'/i);
  assert.match(sql, /retry_warehouse_sale_shopify_sync_job/i);
});

test("internal worker route is secret protected and has no UI surface", async () => {
  const route = await readFile(
    "app/api/internal/warehouse-sales/shopify-worker/route.ts",
    "utf8"
  );
  assert.match(route, /WAREHOUSE_SALES_WORKER_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /export async function POST/);
});

