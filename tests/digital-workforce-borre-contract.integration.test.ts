import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Borre keeps the existing authenticated API and model contract", async () => {
  const [route, chatServer, chatUi] = await Promise.all([
    source("app/api/borre/ask/route.ts"),
    source("lib/intelligence/shared/chat-server.ts"),
    source("app/components/AskBorre.tsx"),
  ]);

  assert.match(route, /export async function POST\(req: Request\)/);
  assert.match(route, /requireRole\(\["admin", "lager"\]\)/);
  assert.match(route, /validateChatInput\(body\)/);
  assert.match(route, /model: CHAT_MODEL/);
  assert.match(route, /getBorreChatSystemPrompt\(\)/);
  assert.match(route, /return NextResponse\.json\(\{[\s\S]*answer:/);
  assert.match(chatServer, /CHAT_MODEL = "gpt-5-mini"/);
  assert.match(chatUi, /"\/api\/borre\/ask"/);
  assert.doesNotMatch(route, /\btools\s*:|\btool_choice\s*:|\bfunction_call\s*:/);
});

test("Borre preserves the existing model message order", async () => {
  const route = await source("app/api/borre/ask/route.ts");
  const systemIndex = route.indexOf("getBorreChatSystemPrompt()");
  const knowledgeIndex = route.indexOf("=== Snake Knowledge ===");
  const historyIndex = route.indexOf("...history.map");
  const questionIndex = route.indexOf("content: question");

  assert.ok(systemIndex >= 0);
  assert.ok(knowledgeIndex > systemIndex);
  assert.ok(historyIndex > knowledgeIndex);
  assert.ok(questionIndex > historyIndex);
});

test("Borre preserves the current read-only warehouse context", async () => {
  const route = await source("app/api/borre/ask/route.ts");

  for (const field of [
    "missingLocationCount",
    "missingSkuCount",
    "emptyLocationCount",
    "quantityDiffCount",
    "placedProductCount",
    "activeProductCount",
    "locationsNoZoneCount",
    "latestShopifySync",
  ]) {
    assert.match(route, new RegExp(`\\b${field}\\b`));
  }

  assert.match(route, /\.from\("inventory"\)/);
  assert.match(route, /\.select\("id, product_id, quantity"\)/);
  assert.match(route, /\.is\("location_id", null\)/);
  assert.match(route, /\.limit\(10\)/);
  assert.match(route, /\.from\("products"\)/);
  assert.match(route, /\.select\("id, product_name, sku"\)/);

  const quantityDiffPriority = route.indexOf("quantityDiffCount > 0");
  const missingLocationPriority = route.indexOf("missingLocationCount > 0");
  const missingZonePriority = route.indexOf("locationsNoZoneCount > 0");
  const missingSkuPriority = route.indexOf("missingSkuCount > 0");
  const emptyLocationPriority = route.indexOf("emptyLocationCount > 0");

  assert.ok(quantityDiffPriority >= 0);
  assert.ok(missingLocationPriority > quantityDiffPriority);
  assert.ok(missingZonePriority > missingLocationPriority);
  assert.ok(missingSkuPriority > missingZonePriority);
  assert.ok(emptyLocationPriority > missingSkuPriority);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
});
