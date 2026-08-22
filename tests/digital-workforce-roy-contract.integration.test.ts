import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Roy is read-only, input-aware, and limited to synced catalog sources", async () => {
  const [capability, provider, contextProvider, prompt] = await Promise.all([
    source("lib/intelligence/workforce/capabilities/shopify-read-catalog.ts"),
    source("lib/intelligence/workforce/contexts/shopify-catalog-provider.ts"),
    source("lib/intelligence/workforce/context-provider.ts"),
    source("lib/intelligence/roy/system.ts"),
  ]);

  assert.match(capability, /id:\s*"shopify\.read_catalog"/);
  assert.match(capability, /effect:\s*"read"/);
  assert.match(contextProvider, /input:\s*ValidChatInput/);
  assert.match(provider, /\.from\("products"\)/);
  assert.match(provider, /\.from\("product_collections"\)/);
  assert.match(provider, /auditSelection/);
  assert.match(provider, /\.eq\("sku", intent\.sku\)/);
  assert.match(provider, /resolveRoyQueryIntent/);
  assert.match(provider, /\.limit\(RESULT_LIMIT\)/);
  assert.match(provider, /variant_name/);
  assert.match(provider, /image_url/);
  assert.match(provider, /shopify_product_id/);
  assert.match(provider, /shopify_variant_id/);
  assert.match(provider, /shopify_inventory_tracked/);
  assert.match(provider, /shopify_inventory_observed_at/);
  assert.doesNotMatch(provider, /\.(insert|update|delete|upsert|rpc)\(/);
  assert.match(prompt, /kan ikke skrive til Shopify eller Snake/);
  assert.match(prompt, /Ikke fyll hull med antakelser/);
  assert.match(prompt, /ukjent, ikke bevis/);
  assert.match(prompt, /Ikke oppfinn taksonomi/);
  assert.match(prompt, /aldri foreslå konkrete nye productType-verdier/);
  assert.match(prompt, /ikke bevis på at en collection er intern/);
});

test("Roy workspace preserves bounded history instead of sending an empty conversation", async () => {
  const workspace = await source("app/shopify/RoyCatalogWorkspace.tsx");
  assert.match(workspace, /HISTORY_STORAGE_KEY/);
  assert.match(workspace, /window\.sessionStorage\.getItem/);
  assert.match(workspace, /useRef<ChatMessage\[\]>\(readWorkspaceHistory\(\)\)/);
  assert.match(workspace, /const persistedHistory\s*=\s*readWorkspaceHistory\(\)/);
  assert.match(workspace, /const requestHistory\s*=\s*persistedHistory\.length\s*\?\s*persistedHistory\s*:\s*historyRef\.current/);
  assert.match(workspace, /history:\s*requestHistory/);
  assert.match(workspace, /historyRef\.current\s*=\s*requestHistory\.concat/);
  assert.match(workspace, /writeWorkspaceHistory\(historyRef\.current\)/);
  assert.match(workspace, /CHAT_LIMITS\.historyMessages/);
  assert.doesNotMatch(workspace, /history:\s*\[\]/);
});

test("Roy route and workspace enforce admin-user scope", async () => {
  const [route, page, navigation] = await Promise.all([
    source("app/api/roy/ask/route.ts"),
    source("app/shopify/page.tsx"),
    source("app/components/navigation/modules.ts"),
  ]);

  assert.match(route, /requireRole\(\["admin", "user"\]\)/);
  assert.match(page, /\["admin", "user"\]\.includes/);
  assert.match(navigation, /id:\s*"shopify"[\s\S]*roles:\s*\["admin", "user"\]/);
  assert.doesNotMatch(route, /warehouse/);
});

test("Roy keeps strict evidence internal and follows the shared colleague communication principle", async () => {
  const [runtime, presentation, communication] = await Promise.all([
    source("lib/intelligence/workforce/runtime.ts"),
    source("lib/intelligence/roy/presentation.ts"),
    source("lib/intelligence/shared/digital-workforce-communication.ts"),
  ]);

  assert.match(runtime, /createRoyUserResponse/);
  assert.match(presentation, /enforceRoyContentContract\(input\.internalAnswer/);
  assert.match(communication, /Digitale ansatte kommuniserer som fagkollegaer/);
  assert.match(communication, /Skjul normalt providerstruktur, rå feltnavn, evidensmarkører/);
});
