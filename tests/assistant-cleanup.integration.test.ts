import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("visible Arne entry points use the active /arne route and prompt", async () => {
  const [labs, route, employee] = await Promise.all([
    source("app/labs/page.tsx"),
    source("app/api/arne/ask/route.ts"),
    source("lib/intelligence/workforce/employees/arne.ts"),
  ]);

  assert.match(labs, /href:\s*"\/arne"/);
  assert.doesNotMatch(labs, /\/borre\/pro/);
  assert.match(
    employee,
    /@\/lib\/intelligence\/arne\/system/
  );
  assert.match(route, /intelligence\/workforce\/runtime/);
});

test("/lager relies on the single floating chat from the root layout", async () => {
  const [layout, warehouse, borrePage] = await Promise.all([
    source("app/layout.tsx"),
    source("app/lager/page.tsx"),
    source("app/borre/page.tsx"),
  ]);

  assert.equal((layout.match(/<AskBorre/g) ?? []).length, 1);
  assert.equal((warehouse.match(/<AskBorre/g) ?? []).length, 0);
  assert.match(borrePage, /<AskBorre mode="page"\s*\/>/);
});

test("BorrePanel renders the supplied message without hidden model I/O", async () => {
  const panel = await source("app/components/BorrePanel.tsx");

  assert.match(panel, /\{message\}/);
  assert.doesNotMatch(panel, /getBorreWarehouseAssessment|OpenAI/);
});
