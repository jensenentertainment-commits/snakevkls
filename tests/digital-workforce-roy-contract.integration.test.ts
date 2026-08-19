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
  assert.match(provider, /\.limit\(RESULT_LIMIT\)/);
  assert.doesNotMatch(provider, /variant_name|image_url/);
  assert.doesNotMatch(provider, /\.(insert|update|delete|upsert|rpc)\(/);
  assert.match(prompt, /kan ikke skrive til Shopify eller Snake/);
  assert.match(prompt, /Ikke fyll hull med antakelser/);
  assert.match(prompt, /ukjent, ikke bevis/);
  assert.match(prompt, /Ikke oppfinn taksonomi/);
  assert.match(prompt, /aldri foreslå konkrete nye productType-verdier/);
  assert.match(prompt, /ikke bevis på at en collection er intern/);
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
