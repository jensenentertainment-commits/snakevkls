import assert from "node:assert/strict";
import test from "node:test";
import { createRoyUserResponse } from "../lib/intelligence/roy/presentation.ts";
import {
  ROY_RECEIVED_CATALOG_FIELDS,
  type ShopifyCatalogContext,
} from "../lib/intelligence/workforce/contexts/shopify-catalog.ts";

const context: ShopifyCatalogContext = {
  intent: { kind: "product", sku: "VK-SCOOT-COOL-500W", reference: "explicit" },
  query: "VK-SCOOT-COOL-500W",
  scope: "targeted_catalog_sample",
  resultLimit: 24,
  receivedFields: ROY_RECEIVED_CATALOG_FIELDS,
  products: [
    {
      shopifyProductId: "product-1",
      shopifyVariantId: "variant-1",
      variantName: null,
      productName: "Elektrisk scooter med kjøleboks – 500W",
      sku: "VK-SCOOT-COOL-500W",
      vendor: "Varekompaniet",
      productType: null,
      priceMinor: 250000,
      currency: "NOK",
      quantity: 1,
      imageReference: null,
      syncedAt: "2026-08-20T10:00:00Z",
      inventoryTracked: true,
      inventoryObservedAt: "2026-08-20T10:00:00Z",
      status: "ACTIVE",
      collections: [
        { title: "Hjem & Fritid", handle: "hjem-fritid" },
        { title: "AVADA Email Marketing - Best Sellers", handle: "avada-best" },
      ],
      variants: [],
      hasProductFieldConflicts: false,
    },
  ],
  entityScope: "variant",
  audit: null,
  limitations: [],
};

const validInternalAnswer = [
  "OBSERVED",
  "- [field=sku] SKU er mottatt.",
  "- [field=productType] Produkttype mangler.",
  "UNKNOWN",
  "- Bilder, beskrivelse og SEO er ikke tilgjengelig.",
  "INFERENCE",
  "- Ingen.",
].join("\n");

function respond(question: string, inputContext = context) {
  return createRoyUserResponse({
    internalAnswer: validInternalAnswer,
    context: inputContext,
    question,
  });
}

test("Roy hides raw fields, evidence markers, and internal classifications", () => {
  const result = respond("Hva kan du fortelle meg om produktet?");
  for (const internalTerm of [
    "priceMinor",
    "receivedFields",
    "[field=",
    "[based_on=",
    "OBSERVED",
    "UNKNOWN",
    "INFERENCE",
  ]) {
    assert.equal(result.includes(internalTerm), false);
  }
});

test("invalid internal model prose still fails closed to a grounded natural response", () => {
  const result = createRoyUserResponse({
    internalAnswer: "Produktet mangler bilder og bør SEO-optimaliseres.",
    context,
    question: "Hva kan du fortelle meg om produktet?",
  });
  assert.match(result, /Elektrisk scooter med kjøleboks/u);
  assert.match(result, /har ikke data om bilder, produktbeskrivelse og SEO/iu);
  assert.doesNotMatch(result, /mangler bilder|SEO-optimaliseres/iu);
});

test("Roy presents price, quantity, and status in natural Norwegian", () => {
  const result = respond("Hva kan du fortelle meg om produktet?");
  assert.match(result, /2[\s\u00a0]500 kr/u);
  assert.match(result, /1 stk\. på lager/u);
  assert.match(result, /aktivt/iu);
  assert.doesNotMatch(result, /250000|ACTIVE/u);
});

test("an explicitly empty received product type may be called missing", () => {
  assert.match(
    respond("Har produktet en produkttype?"),
    /produkttype ikke er registrert/iu,
  );
});

test("unreceived description, images, and SEO remain unknown without advice", () => {
  const result = respond("Mangler produktet bilder, produktbeskrivelse eller SEO, og hva bør vi gjøre?");
  assert.match(result, /har ikke data om bilder, produktbeskrivelse og SEO/iu);
  assert.match(result, /kan jeg ikke vurdere eller anbefale tiltak/iu);
  assert.doesNotMatch(result, /mangler bilder|mangler produktbeskrivelse|SEO bør/iu);
});

test("Roy answers a focused question directly without dumping unrelated fields", () => {
  const result = respond("Hva koster produktet?");
  assert.match(result, /2[\s\u00a0]500 kr/u);
  assert.doesNotMatch(result, /stk\. på lager|produkttype|kolleksjon/iu);
});

test("Roy does not invent a product type taxonomy", () => {
  const withType: ShopifyCatalogContext = {
    ...context,
    products: [{ ...context.products[0], productType: "Elektrisk kjøretøy" }],
  };
  const result = respond("Er produktet kategorisert riktig?", withType);
  assert.match(result, /registrert som «Elektrisk kjøretøy»/u);
  assert.match(result, /kan ikke fastslå om den er riktig uten en godkjent taksonomi/iu);
  assert.doesNotMatch(result, /bør være|endre til/iu);
});

test("AVADA collection names are reported without claiming they are wrong or customer-visible", () => {
  const result = respond("AVADA-collections: er de feil, interne eller kundesynlige, og bør de fjernes?");
  assert.match(result, /AVADA Email Marketing - Best Sellers/u);
  assert.match(result, /navnene alene dokumenterer ikke om de er interne, feil eller synlige for kunder/iu);
  assert.match(result, /kan jeg ikke anbefale å fjerne dem uten et direkte datagrunnlag/iu);
  assert.doesNotMatch(result, /(?:^|\n)De er (?:interne|feil|kundesynlige)|bør fjernes/iu);
});

test("a product type analysis explains the evidence limitation naturally", () => {
  const result = respond("Er produktet kategorisert riktig i Shopify?");
  assert.match(result, /produkttype er ikke registrert/iu);
  assert.match(result, /kan jeg ikke fastslå om produktet er riktig kategorisert/iu);
  assert.doesNotMatch(result, /OBSERVED|UNKNOWN|INFERENCE|\[field=/u);
});
