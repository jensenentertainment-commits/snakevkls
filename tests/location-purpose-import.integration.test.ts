import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260822223701_location_purpose_viper_fallback_and_locations_import.sql";

test("location purpose keeps BUFFER as a Viper fallback", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /location_purpose in \('PICK', 'BUFFER'\)/);
  assert.match(sql, /if sufficient_pick_count > 0 then/);
  assert.match(sql, /candidate_location_purpose := 'PICK'/);
  assert.match(sql, /else\s+candidate_location_purpose := 'BUFFER'/);
  assert.match(
    sql,
    /location\.location_purpose = candidate_location_purpose/,
  );
});

test("warehouse manifest is complete, exact and idempotent", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const codes = sql.match(/\b(?:HL|ML|SL)\d{2}-\d{2}(?:-[A-D])?\b/g) ?? [];
  const uniqueCodes = new Set(codes);

  assert.equal(codes.length, 390);
  assert.equal(uniqueCodes.size, 390);
  assert.equal(codes.filter((code) => code.startsWith("HL")).length, 54);
  assert.equal(codes.filter((code) => code.startsWith("ML")).length, 238);
  assert.equal(codes.filter((code) => code.startsWith("SL")).length, 98);
  assert.match(sql, /where not exists \([\s\S]*location\.code = manifest\.code/);
  assert.match(sql, /Existing warehouse location conflicts with import manifest/);
  assert.match(sql, /Warehouse location import verification failed/);
});
