import assert from "node:assert/strict";
import test from "node:test";
import { resolveRoyQueryIntent } from "../lib/intelligence/roy/query-intent.ts";
import { createRoyUserResponse } from "../lib/intelligence/roy/presentation.ts";
import {
  ROY_RECEIVED_CATALOG_FIELDS,
  type ShopifyCatalogContext,
} from "../lib/intelligence/workforce/contexts/shopify-catalog.ts";

const product = {
  productName: "Prestige X 44 Black Gold",
  sku: "INV-PRESTIGE-X-44-BLK-GLD",
  vendor: "Varekompaniet",
  productType: null,
  priceMinor: 499900,
  currency: "NOK",
  quantity: 2,
  status: "ACTIVE",
  collections: [{ title: "Prestige", handle: "prestige" }],
};

function context(
  intent: ShopifyCatalogContext["intent"],
  products: ShopifyCatalogContext["products"] = [],
): ShopifyCatalogContext {
  return {
    intent,
    query: intent.kind === "product" ? intent.sku : "",
    scope: intent.kind === "knowledge_gap" ? "knowledge_gap" : "targeted_catalog_sample",
    resultLimit: 24,
    receivedFields: ROY_RECEIVED_CATALOG_FIELDS,
    products,
    limitations: [],
  };
}

const groundedInternalAnswer = "OBSERVED\n- [field=sku] SKU er mottatt.\nUNKNOWN\n- Ingen.\nINFERENCE\n- Ingen.";

test("follow-up resolves the concrete SKU from conversation history", () => {
  const intent = resolveRoyQueryIntent({
    question: "Ser du noen problemer med dette produktet?",
    page: "/shopify",
    history: [
      { role: "user", text: "Hva kan du fortelle meg om SKU INV-PRESTIGE-X-44-BLK-GLD?" },
      { role: "assistant", text: "Jeg fant produktet med SKU INV-PRESTIGE-X-44-BLK-GLD." },
    ],
  });

  assert.deepEqual(intent, {
    kind: "product",
    sku: "INV-PRESTIGE-X-44-BLK-GLD",
    reference: "conversation",
  });
});

test("catalog priority questions select a prioritization overview", () => {
  assert.deepEqual(
    resolveRoyQueryIntent({
      question: "Hva bør jeg prioritere i katalogen akkurat nå?",
      page: "/shopify",
      history: [],
    }),
    { kind: "catalog_overview", objective: "prioritize" },
  );
});

test("missing product type questions select an explicit missing-value filter", () => {
  assert.deepEqual(
    resolveRoyQueryIntent({
      question: "Hvilke produkter mangler produkttype?",
      page: "/shopify",
      history: [],
    }),
    { kind: "catalog_filter", filter: { type: "missing_product_type" } },
  );
});

test("collection questions select collection context instead of a generic sample", () => {
  assert.deepEqual(
    resolveRoyQueryIntent({
      question: "Hvilke produkter ligger i AVADA-collection?",
      page: "/shopify",
      history: [],
    }),
    { kind: "catalog_filter", filter: { type: "collection", value: "AVADA" } },
  );
});

test("image questions select an unavailable-data response without products", () => {
  assert.deepEqual(
    resolveRoyQueryIntent({
      question: "Hvilke produkter mangler bilder?",
      page: "/shopify",
      history: [],
    }),
    { kind: "knowledge_gap", topics: ["images"] },
  );
});

test("SEO questions select an unavailable-data response without products", () => {
  assert.deepEqual(
    resolveRoyQueryIntent({
      question: "Hvilke produkter har dårlig SEO?",
      page: "/shopify",
      history: [],
    }),
    { kind: "knowledge_gap", topics: ["seo"] },
  );
});

test("questions about Roy's information needs select capability context", () => {
  assert.deepEqual(
    resolveRoyQueryIntent({
      question: "Hva mangler du av informasjon for å kunne gjøre jobben din bedre?",
      page: "/shopify",
      history: [],
    }),
    { kind: "knowledge_gap", topics: ["capabilities"] },
  );
});

test("an unresolved follow-up asks for SKU instead of widening catalog context", () => {
  const intent = resolveRoyQueryIntent({
    question: "Ser du noen problemer med dette produktet?",
    page: "/shopify",
    history: [],
  });
  assert.deepEqual(intent, { kind: "unresolved_reference" });
  const answer = createRoyUserResponse({
    internalAnswer: groundedInternalAnswer,
    context: context(intent),
    question: "Ser du noen problemer med dette produktet?",
  });
  assert.match(answer, /oppgi SKU-en/iu);
  assert.doesNotMatch(answer, /produkter i det avgrensede utvalget/iu);
});

test("the approved two-turn SKU scenario stays on the same product", () => {
  const intent = resolveRoyQueryIntent({
    question: "Ser du noen problemer med dette produktet?",
    page: "/shopify",
    history: [
      { role: "user", text: "Hva kan du fortelle meg om SKU INV-PRESTIGE-X-44-BLK-GLD?" },
      { role: "assistant", text: "Jeg fant Prestige X 44 Black Gold (SKU INV-PRESTIGE-X-44-BLK-GLD)." },
    ],
  });
  const answer = createRoyUserResponse({
    internalAnswer: groundedInternalAnswer,
    context: context(intent, [product]),
    question: "Ser du noen problemer med dette produktet?",
  });
  assert.match(answer, /INV-PRESTIGE-X-44-BLK-GLD/u);
  assert.match(answer, /produkttype ikke er registrert/iu);
  assert.doesNotMatch(answer, /Jeg fant \d+ produkter/iu);
});

test("unsupported image and SEO questions return only the existing knowledge gap", () => {
  for (const [question, topic] of [
    ["Hvilke produkter mangler bilder?", "images"],
    ["Hvilke produkter har dårlig SEO?", "seo"],
  ] as const) {
    const intent = { kind: "knowledge_gap", topics: [topic] } as const;
    const answer = createRoyUserResponse({
      internalAnswer: groundedInternalAnswer,
      context: context(intent),
      question,
    });
    assert.match(answer, /har ikke data/iu);
    assert.doesNotMatch(answer, /Jeg fant \d+ produkter|mangler bilder|dårlig SEO/iu);
  }
});

test("catalog prioritization presents grounded gaps instead of a product dump", () => {
  const intent = { kind: "catalog_overview", objective: "prioritize" } as const;
  const answer = createRoyUserResponse({
    internalAnswer: groundedInternalAnswer,
    context: context(intent, [product]),
    question: "Hva bør jeg prioritere i katalogen akkurat nå?",
  });
  assert.match(answer, /startet med bekreftede datamangler/iu);
  assert.match(answer, /1 produkt mangler produkttype/iu);
  assert.match(answer, /ikke en kommersiell prioritering av hele katalogen/iu);
  assert.doesNotMatch(answer, /^- /mu);
});
