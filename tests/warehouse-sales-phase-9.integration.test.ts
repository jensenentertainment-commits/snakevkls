import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Vercel Hobby has no automatic warehouse-sale worker schedule", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  const workerCron = config.crons.find(
    (cron: { path: string }) =>
      cron.path === "/api/cron/warehouse-sales-shopify-worker",
  );

  assert.equal(workerCron, undefined);
});

test("manual worker retains its separate secret", async () => {
  const route = await readFile(
    "app/api/internal/warehouse-sales/shopify-worker/route.ts",
    "utf8",
  );

  assert.match(route, /WAREHOUSE_SALES_WORKER_SECRET/);
  assert.match(route, /export async function POST/);
});

test("admin can inspect counts and manually run one job", async () => {
  const route = await readFile(
    "app/api/warehouse-sales/shopify-sync/route.ts",
    "utf8",
  );
  const admin = await readFile(
    "lib/warehouse-sales/admin-shopify-sync.ts",
    "utf8",
  );
  const component = await readFile(
    "app/components/warehouse-sales/ShopifySyncAdmin.tsx",
    "utf8",
  );

  assert.match(route, /requireRole\(\["admin"\]\)/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(admin, /\.eq\("status", "pending"\)/);
  assert.match(admin, /\.eq\("status", "failed"\)/);
  assert.match(admin, /runWarehouseSaleShopifyWorker/);
  assert.match(component, /Synkroniser neste/);
  assert.match(component, /krever oppfølging/);
});

test("Shopify 2026-04 inventory changes opt out of CAS explicitly", async () => {
  const client = await readFile(
    "lib/warehouse-sales/shopify-inventory-client.ts",
    "utf8",
  );

  assert.match(client, /changeFromQuantity: null/);
  assert.match(client, /@idempotent\(key: \$idempotencyKey\)/);
});
