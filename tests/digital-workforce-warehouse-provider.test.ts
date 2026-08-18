import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBorreModelInput,
  formatBorreOperationalContext,
} from "../lib/intelligence/borre/chat-input-builder.ts";
import { createWarehouseSummaryContext } from "../lib/intelligence/workforce/contexts/warehouse-summary.ts";

const context = createWarehouseSummaryContext({
  snakeKnowledge: "Snake knowledge fixture",
  page: "/lager",
  stats: {
    activeProductCount: 100,
    placedProductCount: 80,
    quantityDiffCount: 3,
    missingLocationCount: 5,
    missingSkuCount: 2,
    locationsNoZoneCount: 4,
    emptyLocationCount: 6,
    latestShopifySync: {
      id: "sync-1",
      title: "Fullført",
      action: "shopify_sync_completed",
      created_at: "2026-08-18T10:00:00.000Z",
      metadata: {
        imported: 90,
        skipped_no_sku: 2,
        collections_linked: 7,
        source: "admin",
        duration_ms: 61_500,
      },
    },
  },
  missingInventoryRows: [
    { product_id: "product-1", quantity: 4 },
    { product_id: "missing-product", quantity: null },
  ],
  products: [
    { id: "product-1", product_name: "Testprodukt", sku: "SKU-1" },
  ],
});

test("warehouse summary preserves the operative values used by Borre", () => {
  assert.deepEqual(context.warehouse, {
    activeProducts: 100,
    placedProducts: 80,
    quantityDiffs: 3,
    missingLocations: 5,
    missingSku: 2,
    emptyLocations: 6,
    locationsWithoutZone: 4,
  });
  assert.equal(context.recommendedAction, "Rydd quantity diff først (3 produkter).");
  assert.equal(context.shopifySync?.id, "sync-1");
  assert.deepEqual(context.missingLocationProducts, [
    { productName: "Testprodukt", sku: "SKU-1", quantity: 4 },
    { productName: "Ukjent produkt", sku: null, quantity: 0 },
  ]);
});

test("new formatting is equivalent to today's Borre operational context", () => {
  const expected = `
Snake-status:
- Aktive produkter: 100
- Quantity diff: 3
- Produkter uten lokasjon: 5
- Produkter uten SKU: 2
- Lokasjoner uten sone: 4
- Tomme lokasjoner: 6
- Plasserte produkter: 80
- Snake Health: ${context.health.score}/100
- Snake Health nivå: ${context.health.level}
- Anbefalt første handling: Rydd quantity diff først (3 produkter).
- Nåværende side: /lager
- Siste Shopify-sync:

Status: Fullført (shopify_sync_completed)
Tidspunkt: 2026-08-18T10:00:00.000Z
Sync-ID: sync-1
Importerte produkter: 90
Hoppet over pga. manglende SKU: 2
Koblede collections: 7
Kjørt av: admin
Varighet: 61500 ms (~1m 2s)

Produkter uten lokasjon, første 10:
1. Testprodukt — SKU: SKU-1 — Antall i Snake: 4
2. Ukjent produkt — SKU: mangler — Antall i Snake: 0
`;

  assert.equal(formatBorreOperationalContext(context), expected);
});

test("Borre model input keeps context formatting separate and message order unchanged", () => {
  const messages = buildBorreModelInput({
    systemPrompt: "System prompt fixture",
    context,
    history: [
      { role: "user", text: "Tidligere spørsmål" },
      { role: "assistant", text: "Tidligere svar" },
    ],
    question: "Nytt spørsmål",
  });

  assert.equal(messages[0].role, "system");
  assert.equal(messages[0].content, "System prompt fixture");
  assert.match(messages[1].content, /=== Snake Knowledge ===/);
  assert.match(messages[1].content, /=== Operational Context ===/);
  assert.deepEqual(messages.slice(2), [
    { role: "user", content: "Tidligere spørsmål" },
    { role: "assistant", content: "Tidligere svar" },
    { role: "user", content: "Nytt spørsmål" },
  ]);
});

test("provider reads exactly today's Borre sources and exposes no writes", async () => {
  const provider = await readFile(
    new URL(
      "../lib/intelligence/workforce/contexts/warehouse-summary-provider.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(provider, /getDashboardStats\(\)/);
  assert.match(provider, /buildSnakeKnowledgePrompt\(\)/);
  assert.match(provider, /\.from\("inventory"\)/);
  assert.match(provider, /\.select\("id, product_id, quantity"\)/);
  assert.match(provider, /\.is\("location_id", null\)/);
  assert.match(provider, /\.limit\(10\)/);
  assert.match(provider, /\.from\("products"\)/);
  assert.match(provider, /\.select\("id, product_name, sku"\)/);
  assert.doesNotMatch(
    provider,
    /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/
  );
});
