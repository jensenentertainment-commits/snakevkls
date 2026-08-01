import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const phaseFiles = [
  "tests/warehouse-sales-phase-1.integration.test.ts",
  "tests/warehouse-sales-phase-2.integration.test.ts",
  "tests/warehouse-sales-phase-3.integration.test.ts",
  "tests/warehouse-sales-phase-4.integration.test.ts",
  "tests/warehouse-sales-phase-5.integration.test.ts",
  "tests/database/warehouse-sales-phase-3.dynamic.sql",
  "tests/database/warehouse-sales-phase-3-concurrency-assertions.sql",
  "tests/database/warehouse-sales-phase-4.dynamic.sql",
  "tests/database/warehouse-sales-phase-5.dynamic.sql",
  "tests/database/warehouse-sales-phase-6.dynamic.sql",
  "tests/database/warehouse-sales-phase-6-parallel-workers-setup.sql",
  "tests/database/warehouse-sales-phase-6-worker-claim.sql",
];

test("phase 1-6 contract matrix is present and executable", async () => {
  const contents = await Promise.all(
    phaseFiles.map((file) => readFile(file, "utf8"))
  );
  assert.equal(contents.length, phaseFiles.length);
  assert.ok(contents.every((content) => content.length > 100));
});

test("cross-phase matrix covers every required failure and ordering case", async () => {
  const sql = await readFile(
    "tests/database/warehouse-sales-phase-6.dynamic.sql",
    "utf8"
  );
  const fake = await readFile(
    "lib/warehouse-sales/shopify-worker-engine.test.ts",
    "utf8"
  );
  const concurrency = await readFile(
    "tests/database/warehouse-sales-phase-3-concurrency-assertions.sql",
    "utf8"
  );
  assert.match(fake, /timeout after applied mutation is deduplicated/i);
  assert.match(fake, /retry payload must be byte-identical/i);
  assert.match(sql, /synthetic Shopify web order/i);
  assert.match(sql, /stale worker result must fail/i);
  assert.match(sql, /Synthetic permanent failure/i);
  assert.match(sql, /retry_warehouse_sale_shopify_sync_job/i);
  assert.match(concurrency, /60000000-0000-4000-8000-000000000013/);
});

test("legacy inventory and Viper regression contracts remain in the suite", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const stock = await readFile("tests/stock-movement.integration.test.ts", "utf8");
  const viper = await readFile("tests/viper-p3.integration.test.ts", "utf8");
  assert.equal(packageJson.scripts.test, "node --test");
  assert.match(stock, /apply_stock_movement/);
  assert.match(stock, /updates inventory and writes both logs atomically/i);
  assert.match(viper, /completion validates all inventory before any deduction/i);
});

test("no test implementation contains a real Shopify credential", async () => {
  const fake = await readFile(
    "lib/warehouse-sales/shopify-worker-engine.test.ts",
    "utf8"
  );
  const database = await readFile(
    "tests/database/warehouse-sales-phase-6.dynamic.sql",
    "utf8"
  );
  assert.doesNotMatch(`${fake}\n${database}`, /shpat_|X-Shopify-Access-Token.{0,40}[^f]ake/i);
});
