import assert from "node:assert/strict";
import test from "node:test";
import { resolveRoyQueryIntent } from "../lib/intelligence/roy/query-intent.ts";

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
