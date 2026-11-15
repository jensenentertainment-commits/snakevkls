import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const overview = readFileSync("app/lager/WarehouseOverview.tsx", "utf8");
test("operational overview keeps Viper accessible with honest pilot status and no Lagersalg shortcut", () => {
 assert.match(overview, /href="\/viper"/);
 assert.match(overview, /Pilot gjenstår/);
 assert.doesNotMatch(overview, /warehouse-sales|Lagersalg|Plukkflyt kommer senere/);
});
