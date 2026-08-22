import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogAudit, groupCatalogVariants, type CatalogVariantRow } from "../lib/intelligence/roy/catalog-semantics.ts";
import { buildRoyModelInput } from "../lib/intelligence/roy/chat-input-builder.ts";
import { createRoyUserResponse } from "../lib/intelligence/roy/presentation.ts";
import { ROY_RECEIVED_CATALOG_FIELDS, type ShopifyCatalogContext } from "../lib/intelligence/workforce/contexts/shopify-catalog.ts";

const base = {
  id: "row-1", shopify_product_id: "gid://product/secret", shopify_variant_id: "gid://variant/secret-1",
  sku: "SKU-RED", product_name: "Samme produkt", variant_name: "Red", vendor: "VK", product_type: null,
  shopify_status: "ACTIVE", shopify_price_minor: 10000, shopify_price_currency: "NOK", shopify_quantity: 2,
  image_url: "https://example.invalid/featured.jpg", synced_at: "2026-08-20T10:00:00.000Z",
  shopify_inventory_tracked: true, shopify_inventory_observed_at: "2026-08-20T09:59:00.000Z",
} satisfies CatalogVariantRow;
const rows: CatalogVariantRow[] = [base, { ...base, id: "row-2", shopify_variant_id: "gid://variant/secret-2", sku: "SKU-BLUE", variant_name: "Blue", shopify_quantity: 4 }];

function context(products = groupCatalogVariants(rows, new Map(), "SKU-BLUE")): ShopifyCatalogContext {
  return {
    intent: { kind: "product", sku: "SKU-BLUE", reference: "explicit" }, query: "SKU-BLUE",
    scope: "targeted_catalog_sample", entityScope: "variant", resultLimit: 24,
    receivedFields: ROY_RECEIVED_CATALOG_FIELDS, products, audit: null, limitations: [],
  };
}

test("product scope groups variants while variant scope keeps them separate", () => {
  const products = groupCatalogVariants(rows, new Map());
  assert.equal(products.length, 1);
  assert.equal(products[0].variants.length, 2);
  const audit = buildCatalogAudit(products);
  assert.equal(audit.productCount, 1);
  assert.equal(audit.variantCount, 2);
});

test("explicit SKU selects the correct variant and retains product context", () => {
  const product = context().products[0];
  assert.equal(product.sku, "SKU-BLUE");
  assert.equal(product.variantName, "Blue");
  assert.equal(product.quantity, 4);
  assert.equal(product.productName, "Samme produkt");
});

test("Default Title normalizes to null without becoming a missing-variant audit", () => {
  const products = groupCatalogVariants([{ ...base, variant_name: "Default Title" }], new Map());
  assert.equal(products[0].variantName, null);
  assert.equal(buildCatalogAudit(products).findings.some((finding) => finding.code === "missing_sku"), false);
});

test("featured image reference supports presence only and freshness is natural", () => {
  const answer = createRoyUserResponse({
    internalAnswer: "OBSERVED\n- [field=imageReference] Referanse mottatt.\nUNKNOWN\n- Bildekvalitet er ukjent.\nINFERENCE\n- Ingen.",
    context: context(), question: "Har dette produktet en bildereferanse, og når ble det synkronisert?",
  });
  assert.match(answer, /featured-image-referanse/iu);
  assert.match(answer, /sier ikke noe om bildekvaliteten/iu);
  assert.match(answer, /20\. aug\. 2026/iu);
  assert.doesNotMatch(answer, /godt bilde|dårlig bilde/iu);
});

test("technical Shopify identities never enter normal model context", () => {
  const messages = buildRoyModelInput({ systemPrompt: "system", context: context(), history: [], question: "Spørsmål" });
  const serialized = messages.map((message) => message.content).join("\n");
  assert.doesNotMatch(serialized, /gid:\/\/product|gid:\/\/variant|shopifyProductId|shopifyVariantId/u);
});

test("exact duplicate names and parent-field conflicts are deterministic candidates", () => {
  const products = groupCatalogVariants([
    ...rows,
    { ...base, id: "row-3", shopify_product_id: "gid://product/other", shopify_variant_id: "gid://variant/other", sku: "OTHER" },
    { ...base, id: "row-4", shopify_variant_id: "gid://variant/secret-3", sku: "SKU-GREEN", vendor: "Different" },
  ], new Map());
  const audit = buildCatalogAudit(products);
  assert.equal(audit.findings.find((finding) => finding.code === "exact_duplicate_product_name")?.count, 2);
  assert.equal(audit.findings.find((finding) => finding.code === "inconsistent_product_fields")?.count, 1);
  assert.match(audit.deferred.join(" "), /Collection-dekning|Stale sync/u);
});
