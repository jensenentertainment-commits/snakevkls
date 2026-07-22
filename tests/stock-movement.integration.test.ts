import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260721172143_phase_3_inventory_integrity.sql",
  import.meta.url
);

async function getFunctionBody(name: string) {
  const sql = await readFile(migrationUrl, "utf8");
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `${name} must exist in the Phase 3 migration`);

  const nextFunction = sql.indexOf("create or replace function public.", start + 1);
  return sql.slice(start, nextFunction === -1 ? sql.length : nextFunction);
}

test("stock movement contract locks inventory and rejects negative quantity", async () => {
  const body = await getFunctionBody("apply_stock_movement");

  assert.match(body, /for update/i);
  assert.match(
    body,
    /if current_inventory\.quantity \+ requested_quantity_delta < 0 then/i
  );
  assert.match(body, /raise exception 'Insufficient inventory'/i);
});

test("stock movement contract updates inventory and writes both logs atomically", async () => {
  const body = await getFunctionBody("apply_stock_movement");

  const inventoryUpdate = body.indexOf("update public.inventory");
  const movementInsert = body.indexOf("insert into public.stock_movements");
  const activityInsert = body.indexOf("insert into public.activity_log");

  assert.ok(inventoryUpdate > 0);
  assert.ok(movementInsert > inventoryUpdate);
  assert.ok(activityInsert > movementInsert);
  assert.doesNotMatch(body, /exception\s+when/i);
});
