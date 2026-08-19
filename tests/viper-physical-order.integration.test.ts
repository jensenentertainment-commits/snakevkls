import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type PickTarget = {
  externalLineId: string;
  locationId: string;
  locationCode: string;
  zonePickPriority: number;
  locationPickSequence: number;
  shopifySequence: number;
};

function materializationOrder(lines: PickTarget[]) {
  return lines.toSorted(
    (a, b) =>
      a.zonePickPriority - b.zonePickPriority ||
      a.locationPickSequence - b.locationPickSequence ||
      a.locationId.localeCompare(b.locationId) ||
      a.externalLineId.localeCompare(b.externalLineId)
  );
}

test("Viper SQL assigns a new physical sequence instead of Shopify sequence", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260819183002_viper_physical_pick_order.sql",
      import.meta.url
    ),
    "utf8"
  );
  const materializationLoop = migration.slice(
    migration.indexOf("for prepared_line in")
  );

  assert.match(
    materializationLoop,
    /order by\s+\(value ->> 'zonePickPriority'\)::integer,\s+\(value ->> 'locationPickSequence'\)::integer,\s+value ->> 'locationId',\s+value ->> 'externalLineId'/
  );
  assert.match(materializationLoop, /physical_sequence_number := physical_sequence_number \+ 1/);
  assert.match(materializationLoop, /physical_sequence_number\s+\);/);
  assert.doesNotMatch(
    materializationLoop.slice(0, materializationLoop.indexOf("insert into public.viper_events")),
    /order by[^;]*sequenceNumber/
  );
  assert.match(migration, /Viper physical pick order is missing/);
});

test("physical order includes only represented zones and ignores Shopify line order", () => {
  const allZones: PickTarget[] = [
    { externalLineId: "4", locationId: "sl", locationCode: "SL02", zonePickPriority: 4, locationPickSequence: 2, shopifySequence: 1 },
    { externalLineId: "2", locationId: "me", locationCode: "ME01", zonePickPriority: 2, locationPickSequence: 1, shopifySequence: 2 },
    { externalLineId: "3", locationId: "ml", locationCode: "ML05", zonePickPriority: 3, locationPickSequence: 5, shopifySequence: 3 },
    { externalLineId: "1", locationId: "hl", locationCode: "HL03", zonePickPriority: 1, locationPickSequence: 3, shopifySequence: 4 },
  ];

  assert.deepEqual(
    materializationOrder(allZones).map((line) => line.locationCode),
    ["HL03", "ME01", "ML05", "SL02"]
  );

  assert.deepEqual(
    materializationOrder(allZones.filter((line) => line.locationCode !== "ME01"))
      .map((line) => line.locationCode),
    ["HL03", "ML05", "SL02"]
  );
});

test("location sequence orders within a zone without renaming identities", () => {
  const lines: PickTarget[] = [
    { externalLineId: "sl", locationId: "3", locationCode: "SL02", zonePickPriority: 4, locationPickSequence: 2, shopifySequence: 1 },
    { externalLineId: "me-b", locationId: "2", locationCode: "ME-custom-b", zonePickPriority: 2, locationPickSequence: 2, shopifySequence: 2 },
    { externalLineId: "me-a", locationId: "1", locationCode: "ME-custom-a", zonePickPriority: 2, locationPickSequence: 1, shopifySequence: 3 },
  ];
  const first = materializationOrder(lines);
  const second = materializationOrder([...lines].reverse());

  assert.deepEqual(first.map((line) => line.locationCode), ["ME-custom-a", "ME-custom-b", "SL02"]);
  assert.deepEqual(second, first);
  assert.deepEqual(lines.map((line) => line.locationCode), ["SL02", "ME-custom-b", "ME-custom-a"]);
});
