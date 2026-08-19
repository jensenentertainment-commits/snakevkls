import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("physical pick order is explicit and constrained independently of codes", async () => {
  const migration = await source(
    "supabase/migrations/20260819182058_future_foundation_physical_pick_order.sql"
  );

  assert.match(migration, /zones[\s\S]*add column pick_priority integer/);
  assert.match(migration, /when 'HL' then 1[\s\S]*when 'ME' then 2[\s\S]*when 'ML' then 3[\s\S]*when 'SL' then 4/);
  assert.match(migration, /alter column pick_priority set not null/);
  assert.match(migration, /unique \(pick_priority\)/);
  assert.match(migration, /locations[\s\S]*add column pick_sequence integer/);
  assert.match(migration, /check \(pick_sequence is null or pick_sequence > 0\)/);
  assert.match(migration, /on public\.locations \(zone_id, pick_sequence\)/);
  assert.match(migration, /where pick_sequence is not null/);
  assert.doesNotMatch(migration, /substring|regexp|split_part|left\(code|order by code/i);
});

test("existing admin surfaces can maintain both ordering values", async () => {
  const [zonesPage, settingsPage, locationsPage] = await Promise.all([
    source("app/zones/page.tsx"),
    source("app/settings/page.tsx"),
    source("app/locations/page.tsx"),
  ]);

  for (const zoneSurface of [zonesPage, settingsPage]) {
    assert.match(zoneSurface, /pick_priority/);
    assert.match(zoneSurface, /Number\.isInteger\(pickPriority\)/);
  }

  assert.match(locationsPage, /pick_sequence/);
  assert.match(locationsPage, /Number\.isInteger\(pickSequence\)/);
  assert.match(locationsPage, /location\.code/);
});
