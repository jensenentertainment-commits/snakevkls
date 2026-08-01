import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

test("completion accepts only Vipps and cash without changing stock semantics", () => {
  const migration = read(
    "supabase/migrations/20260801185133_warehouse_sales_cash_payment.sql",
  );

  assert.match(migration, /requested_payment_method not in \('vipps', 'cash'\)/i);
  assert.match(migration, /payment_method,[\s\S]*requested_payment_method/i);
  assert.match(migration, /'paymentMethod', requested_payment_method/i);
  assert.match(migration, /set quantity = quantity - deduct_quantity/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /insert into public\.warehouse_sale_shopify_sync_jobs/i);
  assert.doesNotMatch(migration, /fetch\(|inventoryAdjustQuantities/i);
});

test("Vipps is default and changing payment keeps the operation identity safe", () => {
  const provider = read(
    "app/components/warehouse-sales/WarehouseSalesProvider.tsx",
  );

  assert.match(provider, /useState<WarehouseSalePaymentMethod>\("vipps"\)/);
  assert.match(provider, /paymentMethod,/);
  assert.match(provider, /operationKeyRef\.current = null;[\s\S]*setPaymentMethodState/);
  assert.match(provider, /operationKeyRef\.current \?\?= crypto\.randomUUID\(\)/);
});

test("confirmation copy follows the selected payment method", () => {
  const cart = read("app/components/warehouse-sales/SaleCart.tsx");

  assert.match(cart, /\["vipps", "Vipps"\]/);
  assert.match(cart, /\["cash", "Kontant"\]/);
  assert.match(
    cart,
    /Kontroller at beløpet er mottatt på Vipps før salget fullføres\./,
  );
  assert.match(
    cart,
    /Kontroller at beløpet er mottatt kontant før salget fullføres\./,
  );
  assert.match(cart, /Snake registrerer ikke selve betalingen/);
});

test("history and internal document render the stored payment method", () => {
  const repository = read("lib/warehouse-sales/repository.ts");
  const history = read("app/components/warehouse-sales/SaleHistory.tsx");
  const document = read("app/components/warehouse-sales/SaleDocument.tsx");

  assert.match(repository, /payment_method/);
  assert.match(repository, /sale\.payment_method === "cash" \? "cash" : "vipps"/);
  assert.match(history, /formatPaymentMethod\(sale\.paymentMethod\)/);
  assert.match(document, /formatPaymentMethod\(sale\.paymentMethod\)/);
});
