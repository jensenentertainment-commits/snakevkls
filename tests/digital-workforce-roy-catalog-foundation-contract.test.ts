import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRoyCatalogFoundation, ROY_CATALOG_FOUNDATION_FIELDS, ROY_CATALOG_FOUNDATION_FINDINGS,
  ROY_CATALOG_FOUNDATION_FRESHNESS, ROY_CATALOG_FOUNDATION_LIMITATIONS, ROY_CATALOG_FOUNDATION_LIMITS,
  type RoyCatalogFoundation, type RoyCatalogFoundationExample,
} from "../lib/intelligence/roy/catalog-foundation-contract.ts";

function report(products = 30, unknown = 5): RoyCatalogFoundation {
  const observed = products - unknown;
  const result: RoyCatalogFoundation = {
    schemaVersion: 1, scope: "active_shopify_products", scopeAuthority: "snake_products_active_shopify_linked",
    generatedAt: "2026-09-17T20:00:00+00:00", totals: { productCount: products, variantCount: products * 2 },
    contentCoverage: { observedProductCount: observed, unknownProductCount: unknown },
    fields: Object.fromEntries(ROY_CATALOG_FOUNDATION_FIELDS.map((field) =>
      [field, { unknownCount: unknown, missingCount: observed, presentCount: 0 }])) as RoyCatalogFoundation["fields"],
    collections: { unknownOrIncompleteProductCount: unknown, completeProductCount: observed,
      completeWithZeroCollectionsCount: observed, completeWithCollectionsCount: 0 },
    freshness: Object.fromEntries(ROY_CATALOG_FOUNDATION_FRESHNESS.map((key) => [key, {
      populationUnit: key === "variantSyncedAt" ? "variant" : "product",
      populationCount: key === "variantSyncedAt" ? products * 2 : products,
      timestampCount: key === "variantSyncedAt" ? products * 2 : observed,
      oldest: (key === "variantSyncedAt" ? products : observed) ? "2026-09-15T08:00:00Z" : null,
      newest: (key === "variantSyncedAt" ? products : observed) ? "2026-09-16T08:00:00Z" : null,
    }])) as RoyCatalogFoundation["freshness"],
    findings: ROY_CATALOG_FOUNDATION_FINDINGS.map((code) => ({
      code, scope: "product" as const, affectedProductCount: ["content_unknown", "collections_unknown_or_incomplete"].includes(code) ? unknown : observed,
      examples: [], examplesTruncated: true,
    })).filter((f) => f.affectedProductCount > 0),
    evidence: { returnedExampleCount: 0, truncated: products > 0, budgetLimited: false },
    limits: { ...ROY_CATALOG_FOUNDATION_LIMITS }, limitations: [...ROY_CATALOG_FOUNDATION_LIMITATIONS],
  };
  return result;
}

function example(index = 0): RoyCatalogFoundationExample {
  return { productLabel: `Product ${index}`, representativeSku: `SKU-${index}`, labelSource: "variant", labelTruncated: false, skuTruncated: false };
}

function withExamples(result: RoyCatalogFoundation, allocations: number[]) {
  result.findings.forEach((finding, index) => {
    finding.examples = Array.from({ length: allocations[index] ?? 0 }, (_, i) => example(i));
    finding.examplesTruncated = finding.examples.length < finding.affectedProductCount;
  });
  result.evidence.returnedExampleCount = result.findings.reduce((n, f) => n + f.examples.length, 0);
  result.evidence.truncated = result.findings.some((f) => f.examplesTruncated);
  return result;
}

test("accepts empty catalog with explicit zero populations and null timestamps", () => {
  assert.deepEqual(parseRoyCatalogFoundation(report(0, 0)), report(0, 0));
});

test("unknown content never becomes missing; category and type remain independent", () => {
  const unknown = report(5, 5);
  assert.equal(parseRoyCatalogFoundation(unknown).fields.description.missingCount, 0);
  const result = report();
  result.fields.shopifyCategory = { unknownCount: 5, missingCount: 0, presentCount: 25 };
  result.findings = result.findings.filter((f) => f.code !== "missing_shopify_category");
  assert.equal(parseRoyCatalogFoundation(result).fields.productType.missingCount, 25);
  result.fields.description.unknownCount = 0;
  result.fields.description.missingCount = 30;
  assert.throws(() => parseRoyCatalogFoundation(result), /field state partition/);
});

test("complete empty and incomplete memberships are distinct aggregate populations", () => {
  const result = report(10, 4);
  assert.equal(parseRoyCatalogFoundation(result).collections.completeWithZeroCollectionsCount, 6);
  result.collections.completeWithZeroCollectionsCount = 10;
  assert.throws(() => parseRoyCatalogFoundation(result), /collection states/);
});

test("accepts 8 per finding and 24 total, rejects either cap being exceeded", () => {
  assert.doesNotThrow(() => parseRoyCatalogFoundation(withExamples(report(40, 10), [8, 8, 8])));
  assert.throws(() => parseRoyCatalogFoundation(withExamples(report(40, 10), [9])), /per finding/);
  assert.throws(() => parseRoyCatalogFoundation(withExamples(report(40, 10), [8, 8, 8, 1])), /global evidence/);
});

test("bounded UTF-8 payload checks bytes rather than characters; oversized responses fail closed", () => {
  const value = withExamples(report(40, 10), [8, 8, 8]);
  for (const finding of value.findings) for (const entry of finding.examples) {
    entry.productLabel = "🧰".repeat(240);
    entry.representativeSku = "🧰".repeat(120);
  }
  assert.ok(JSON.stringify(value).length < 32768);
  assert.ok(new TextEncoder().encode(JSON.stringify(value)).byteLength > 32768);
  assert.throws(() => parseRoyCatalogFoundation(value), /byte budget/);
});

test("evidence labels are bounded by Unicode code points and technical IDs are never allowed", () => {
  const value = withExamples(report(), [1]);
  value.findings[0].examples[0].productLabel = "🧰".repeat(240);
  assert.doesNotThrow(() => parseRoyCatalogFoundation(value));
  for (const productLabel of ["x".repeat(241), "", " \t ", "gid://shopify/Product/1", "Product GID://SHOPIFY/Collection/1", "Bad\u0085label"]) {
    value.findings[0].examples[0].productLabel = productLabel;
    assert.throws(() => parseRoyCatalogFoundation(value));
  }
  value.findings[0].examples[0] = { ...example(), representativeSku: "gid://shopify/ProductVariant/2" };
  assert.throws(() => parseRoyCatalogFoundation(value), /unsafe evidence/);
});

test("unknown-content examples must use variant label provenance", () => {
  const value = withExamples(report(), [1]);
  value.findings[0].examples[0].labelSource = "product_content";
  assert.throws(() => parseRoyCatalogFoundation(value), /unobserved content/);
});

test("counts stay exact and both finding and response truncation indicators are mandatory", () => {
  const result = withExamples(report(), [1]);
  result.evidence.budgetLimited = true;
  assert.equal(parseRoyCatalogFoundation(result).findings[0].affectedProductCount, 5);
  for (const mutate of [
    (v: RoyCatalogFoundation) => { v.findings[0].examplesTruncated = false; },
    (v: RoyCatalogFoundation) => { v.evidence.truncated = false; },
    (v: RoyCatalogFoundation) => { v.evidence.returnedExampleCount = 0; },
    (v: RoyCatalogFoundation) => { v.findings[0].affectedProductCount = 4; },
  ]) {
    const value = structuredClone(result);
    mutate(value);
    assert.throws(() => parseRoyCatalogFoundation(value));
  }
});

test("timestamp coverage has separate populations and cannot imply invented observations", () => {
  const value = report();
  assert.equal(parseRoyCatalogFoundation(value).freshness.contentObservedAt.timestampCount, 25);
  for (const mutate of [
    (v: RoyCatalogFoundation) => { v.freshness.collectionsObservedAt.timestampCount = 30; },
    (v: RoyCatalogFoundation) => { v.freshness.variantSyncedAt.populationCount = 30; },
    (v: RoyCatalogFoundation) => { v.freshness.shopifyUpdatedAt.oldest = "infinity"; },
    (v: RoyCatalogFoundation) => { v.freshness.contentObservedAt.newest = "2020-01-01T00:00:00Z"; },
  ]) {
    const changed = structuredClone(value);
    mutate(changed);
    assert.throws(() => parseRoyCatalogFoundation(changed));
  }
});

test("unexpected fields, unbounded source bodies, altered limits and policy findings are rejected", () => {
  const value = withExamples(report(), [1]);
  for (const mutate of [
    (v: Record<string, unknown>) => { v.vendor = "Supplier"; },
    (v: Record<string, unknown>) => { v.schemaVersion = 2; },
    (v: Record<string, unknown>) => { v.limitations = []; },
    (v: Record<string, unknown>) => { v.limits = { ...ROY_CATALOG_FOUNDATION_LIMITS, maxExamplesPerFinding: 100 }; },
    (v: Record<string, unknown>) => { v.staleCount = 5; },
  ]) {
    const changed = structuredClone(value) as unknown as Record<string, unknown>;
    mutate(changed);
    assert.throws(() => parseRoyCatalogFoundation(changed));
  }
  const changed = structuredClone(value);
  Object.assign(changed.findings[0].examples[0], { shopifyProductId: "gid://shopify/Product/1", description: "Full description" });
  assert.throws(() => parseRoyCatalogFoundation(changed), /unexpected/);
  changed.findings[0].code = "seo_quality" as never;
  assert.throws(() => parseRoyCatalogFoundation(changed));
});

test("errors, incomplete payloads and unsafe integer counts never become empty-catalog results", () => {
  for (const value of [null, {}, [], { error: "RPC unavailable" }]) assert.throws(() => parseRoyCatalogFoundation(value));
  for (const productCount of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1.5]) {
    const value = report();
    value.totals.productCount = productCount;
    assert.throws(() => parseRoyCatalogFoundation(value));
  }
});
