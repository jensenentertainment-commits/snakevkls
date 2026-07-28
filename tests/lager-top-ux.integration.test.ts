import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function readProjectFile(file: string) {
  return readFileSync(join(root, file), "utf8");
}

test("Lager top keeps real status data and presents Snake Health once", () => {
  const page = readProjectFile("app/lager/page.tsx");
  const pulse = readProjectFile(
    "app/components/dashboard/SystemPulseBar.tsx",
  );
  const priority = readProjectFile(
    "app/components/SnakeIntelligencePanel.tsx",
  );

  assert.match(page, /activeProducts=\{activeProductCount\}/);
  assert.match(page, /snakeHealth=\{health\.score\}/);
  assert.doesNotMatch(page, /lastSyncOk|emptyLocations=\{0\}/);
  assert.doesNotMatch(pulse, /Shopify|lastSyncOk|emptyLocations/);

  const visibleHealthLabels = [page, pulse, priority]
    .join("\n")
    .match(/Snake Health/g);
  assert.equal(visibleHealthLabels?.length, 1);
});

test("Lager priority surface preserves recommendation and operative links", () => {
  const priority = readProjectFile(
    "app/components/SnakeIntelligencePanel.tsx",
  );

  assert.match(priority, /getRecommendedAction\(metrics\)/);
  assert.match(priority, /Prioritert nå/);
  assert.match(priority, /Vurdert av Børre/);

  for (const href of [
    "/products?status=diff",
    "/fix-locations",
    "/locations",
  ]) {
    assert.match(priority, new RegExp(`href="${href.replace("?", "\\?")}"`));
  }

  assert.match(priority, /label="Quantity diff"/);
  assert.match(priority, /label="Uten lokasjon"/);
  assert.match(priority, /label="Uten sone"/);
  assert.doesNotMatch(priority, /label="Plassert"|label="Bør sjekkes"/i);
});

test("Lager no longer renders Snakeboard while its feature remains available", () => {
  const page = readProjectFile("app/lager/page.tsx");

  assert.doesNotMatch(page, /SnakeBoardPreview|href="\/snakeboard"/);
  assert.ok(
    existsSync(join(root, "app/components/SnakeBoardPreview.tsx")),
    "SnakeBoardPreview component must remain",
  );
  assert.ok(
    existsSync(join(root, "app/snakeboard/page.tsx")),
    "Snakeboard route must remain",
  );
  assert.ok(
    existsSync(join(root, "app/api/snakeboard/route.ts")),
    "Snakeboard API must remain",
  );
});
