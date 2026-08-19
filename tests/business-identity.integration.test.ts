import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getSnakeKnowledge } from "../lib/intelligence/shared/snake-knowledge.ts";

test("shared knowledge keeps company, brand, store and warehouse distinct", async () => {
  const knowledge = getSnakeKnowledge();
  const promptBuilder = await readFile(
    new URL(
      "../lib/intelligence/shared/build-snake-knowledge.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.equal(knowledge.identity.company, "Outlet Service AS");
  assert.equal(knowledge.identity.operatingBrand, "Varekompaniet");
  assert.match(knowledge.direction.roleOfVarekompaniet, /brand og nettbutikk/);
  assert.match(knowledge.direction.roleOfWarehouse, /virksomhetsressurs/);
  assert.match(knowledge.direction.roleOfShopify, /salgskanal for Varekompaniet/);

  assert.match(promptBuilder, /Virksomhet:[\s\S]*k\.identity\.company/);
  assert.match(
    promptBuilder,
    /Operativt brand\/nettbutikk:[\s\S]*k\.identity\.operatingBrand/
  );
  assert.doesNotMatch(
    promptBuilder,
    /# Prioriteringer|Kundeservice i Snake|currentSprint/
  );
});
