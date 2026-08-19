import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Borre keeps the existing authenticated API and model contract", async () => {
  const [route, runtime, employee, chatServer, chatUi] = await Promise.all([
    source("app/api/borre/ask/route.ts"),
    source("lib/intelligence/workforce/runtime.ts"),
    source("lib/intelligence/workforce/employees/borre.ts"),
    source("lib/intelligence/shared/chat-server.ts"),
    source("app/components/AskBorre.tsx"),
  ]);

  assert.match(route, /export async function POST\(req: Request\)/);
  assert.match(
    route,
    /requireRole\(\["admin", "user", "warehouse", "lager"\]\)/,
  );
  assert.match(route, /validateChatInput\(body\)/);
  assert.match(route, /runReadOnlyEmployeeRequest\(\{/);
  assert.match(route, /employeeId: "borre"/);
  assert.match(route, /capabilityId: "warehouse\.read_summary"/);
  assert.match(route, /return NextResponse\.json\([\s\S]*\{ answer: result\.answer \}/);
  assert.match(chatServer, /CHAT_MODEL = "gpt-5-mini"/);
  assert.match(employee, /id:\s*CHAT_MODEL/);
  assert.match(employee, /getSystemPrompt:\s*getBorreChatSystemPrompt/);
  assert.match(runtime, /getChatOpenAIClient\(\)\.responses\.create\(request\)/);
  assert.match(chatUi, /"\/api\/borre\/ask"/);
  assert.doesNotMatch(
    `${route}\n${runtime}`,
    /\btools\s*:|\btool_choice\s*:|\bfunction_call\s*:/
  );
});

test("Borre preserves the existing model message order", async () => {
  const builder = await source(
    "lib/intelligence/borre/chat-input-builder.ts"
  );
  const systemIndex = builder.indexOf('role: "system"');
  const knowledgeIndex = builder.indexOf("=== Snake Knowledge ===");
  const historyIndex = builder.indexOf("...input.history.map");
  const questionIndex = builder.indexOf("content: input.question");

  assert.ok(systemIndex >= 0);
  assert.ok(knowledgeIndex > systemIndex);
  assert.ok(historyIndex > knowledgeIndex);
  assert.ok(questionIndex > historyIndex);
});

test("Borre preserves the current read-only warehouse context", async () => {
  const [provider, context] = await Promise.all([
    source(
      "lib/intelligence/workforce/contexts/warehouse-summary-provider.ts"
    ),
    source("lib/intelligence/workforce/contexts/warehouse-summary.ts"),
  ]);
  const implementation = `${provider}\n${context}`;

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
    assert.match(implementation, new RegExp(`\\b${field}\\b`));
  }

  assert.match(provider, /\.from\("inventory"\)/);
  assert.match(provider, /\.select\("id, product_id, quantity"\)/);
  assert.match(provider, /\.is\("location_id", null\)/);
  assert.match(provider, /\.limit\(10\)/);
  assert.match(provider, /\.from\("products"\)/);
  assert.match(provider, /\.select\("id, product_name, sku"\)/);

  const quantityDiffPriority = context.indexOf("quantityDiffCount > 0");
  const missingLocationPriority = context.indexOf("missingLocationCount > 0");
  const missingZonePriority = context.indexOf("locationsNoZoneCount > 0");
  const missingSkuPriority = context.indexOf("missingSkuCount > 0");
  const emptyLocationPriority = context.indexOf("emptyLocationCount > 0");

  assert.ok(quantityDiffPriority >= 0);
  assert.ok(missingLocationPriority > quantityDiffPriority);
  assert.ok(missingZonePriority > missingLocationPriority);
  assert.ok(missingSkuPriority > missingZonePriority);
  assert.ok(emptyLocationPriority > missingSkuPriority);
  assert.doesNotMatch(
    implementation,
    /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/
  );
});
