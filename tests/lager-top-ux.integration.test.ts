import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function readProjectFile(file: string) {
  return readFileSync(join(root, file), "utf8");
}

test("Lager omits legacy Borre assessments and Health without removing warehouse tools", () => {
  const page = readProjectFile("app/lager/page.tsx");
  assert.doesNotMatch(page, /SnakeIntelligencePanel|SystemPulseBar|getWarehouseHealth|Vurdert av Børre/);
  for (const href of ["/products", "/locations", "/fix-locations", "/issues", "/viper", "/location-count", "/activities"]) {
    assert.ok(page.includes('"'+href+'"'));
  }
  assert.ok(existsSync(join(root, "app/components/SnakeIntelligencePanel.tsx")));
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
