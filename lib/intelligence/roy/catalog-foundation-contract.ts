/** Inactive Phase 2A aggregate contract. No provider, RPC client or model integration. */
export const ROY_CATALOG_FOUNDATION_RPC = "get_roy_catalog_foundation_v1" as const;
export const ROY_CATALOG_FOUNDATION_LIMITS = {
  maxExamplesPerFinding: 8,
  maxExamplesTotal: 24,
  maxResponseBytes: 32768,
  maxProductLabelCharacters: 240,
  maxSkuCharacters: 120,
} as const;

export const ROY_CATALOG_FOUNDATION_FIELDS = [
  "productName", "description", "seoTitle", "seoDescription", "productHandle",
  "productType", "shopifyCategory", "imageReference",
] as const;
export type RoyCatalogFoundationField = typeof ROY_CATALOG_FOUNDATION_FIELDS[number];

export const ROY_CATALOG_FOUNDATION_FINDINGS = [
  "content_unknown", "missing_product_name", "missing_description", "missing_seo_title",
  "missing_seo_description", "missing_product_handle", "missing_product_type",
  "missing_shopify_category", "missing_image_reference", "collections_unknown_or_incomplete",
  "collections_complete_zero",
] as const;
export type RoyCatalogFoundationFindingCode = typeof ROY_CATALOG_FOUNDATION_FINDINGS[number];

export const ROY_CATALOG_FOUNDATION_LIMITATIONS = [
  "Counts describe Snake's persisted active Shopify-linked catalog, not independently verified live Shopify totals.",
  "Canonical-only products are excluded; products.active and non-null Shopify product identity define scope.",
  "Observations are last committed snapshots, not the outcome of the latest refresh attempt.",
  "Presence is not quality, correctness or relevance.",
  "Freshness is descriptive; no stale threshold is defined.",
  "Catalog observations may span sync pages and observation times.",
] as const;

export const ROY_CATALOG_FOUNDATION_FRESHNESS = [
  "variantSyncedAt", "contentObservedAt", "collectionsObservedAt", "shopifyUpdatedAt", "contentPersistedAt",
] as const;

export type RoyCatalogFoundationExample = {
  productLabel: string;
  labelSource: "product_content" | "variant";
  /** A representative variant's SKU, not product identity. */
  representativeSku: string | null;
  labelTruncated: boolean;
  skuTruncated: boolean;
};

export type RoyCatalogFoundation = {
  schemaVersion: 1;
  scope: "active_shopify_products";
  scopeAuthority: "snake_products_active_shopify_linked";
  generatedAt: string;
  totals: { productCount: number; variantCount: number };
  contentCoverage: { observedProductCount: number; unknownProductCount: number };
  fields: Record<RoyCatalogFoundationField, { unknownCount: number; missingCount: number; presentCount: number }>;
  collections: {
    unknownOrIncompleteProductCount: number;
    completeProductCount: number;
    completeWithZeroCollectionsCount: number;
    completeWithCollectionsCount: number;
  };
  freshness: Record<typeof ROY_CATALOG_FOUNDATION_FRESHNESS[number], {
    populationUnit: "product" | "variant";
    populationCount: number;
    timestampCount: number;
    oldest: string | null;
    newest: string | null;
  }>;
  findings: {
    code: RoyCatalogFoundationFindingCode;
    scope: "product";
    affectedProductCount: number;
    examples: RoyCatalogFoundationExample[];
    examplesTruncated: boolean;
  }[];
  evidence: { returnedExampleCount: number; truncated: boolean; budgetLimited: boolean };
  limits: typeof ROY_CATALOG_FOUNDATION_LIMITS;
  limitations: readonly string[];
};

function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid Roy catalog foundation: ${message}`);
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), "expected object");
  const result = value as Record<string, unknown>;
  requireValue(Object.keys(result).length === keys.length && keys.every((key) => Object.hasOwn(result, key)), "unexpected/missing keys");
  return result;
}

function count(value: unknown): number {
  requireValue(Number.isSafeInteger(value) && (value as number) >= 0, "invalid count");
  return value as number;
}

function timestamp(value: unknown): asserts value is string {
  requireValue(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value)), "invalid timestamp");
}

function label(value: unknown, max: number): asserts value is string {
  requireValue(typeof value === "string" && value.trim().length > 0 && Array.from(value).length <= max,
    "invalid evidence label length");
  requireValue(!/gid:\/\/shopify\//i.test(value) && !/[\u0000-\u001f\u007f-\u009f]/u.test(value), "unsafe evidence label");
}

/**
 * Validate untrusted RPC JSON before any future use. Unknown keys, changed limits,
 * non-partitioning counts, technical IDs and unbounded evidence are errors, never
 * an empty catalog. This function is deliberately not connected to Roy yet.
 */
export function parseRoyCatalogFoundation(value: unknown): RoyCatalogFoundation {
  const serialized = JSON.stringify(value);
  requireValue(typeof serialized === "string" && new TextEncoder().encode(serialized).byteLength <= ROY_CATALOG_FOUNDATION_LIMITS.maxResponseBytes,
    "response exceeds byte budget");
  const root = object(value, ["schemaVersion", "scope", "scopeAuthority", "generatedAt", "totals", "contentCoverage", "fields",
    "collections", "freshness", "findings", "evidence", "limits", "limitations"]);
  requireValue(root.schemaVersion === 1 && root.scope === "active_shopify_products"
    && root.scopeAuthority === "snake_products_active_shopify_linked", "unsupported version/scope");
  timestamp(root.generatedAt);
  const limits = object(root.limits, Object.keys(ROY_CATALOG_FOUNDATION_LIMITS));
  for (const [key, expected] of Object.entries(ROY_CATALOG_FOUNDATION_LIMITS)) requireValue(limits[key] === expected, "changed limits");
  const limitations = root.limitations;
  requireValue(Array.isArray(limitations) && limitations.length === ROY_CATALOG_FOUNDATION_LIMITATIONS.length
    && ROY_CATALOG_FOUNDATION_LIMITATIONS.every((text, index) => limitations[index] === text), "missing scope limitations");

  const totals = object(root.totals, ["productCount", "variantCount"]);
  const products = count(totals.productCount);
  const variants = count(totals.variantCount);
  requireValue(variants >= products && (products > 0 || variants === 0), "invalid catalog populations");
  const coverage = object(root.contentCoverage, ["observedProductCount", "unknownProductCount"]);
  const observed = count(coverage.observedProductCount);
  const unknown = count(coverage.unknownProductCount);
  requireValue(observed + unknown === products, "content coverage does not partition products");
  const expectedFindings: Record<string, number> = { content_unknown: unknown };
  const fields = object(root.fields, ROY_CATALOG_FOUNDATION_FIELDS);
  ROY_CATALOG_FOUNDATION_FIELDS.forEach((field, index) => {
    const states = object(fields[field], ["unknownCount", "missingCount", "presentCount"]);
    const missing = count(states.missingCount);
    requireValue(count(states.unknownCount) === unknown && unknown + missing + count(states.presentCount) === products,
      `field state partition for ${field}`);
    expectedFindings[ROY_CATALOG_FOUNDATION_FINDINGS[index + 1]] = missing;
  });
  const collections = object(root.collections, ["unknownOrIncompleteProductCount", "completeProductCount", "completeWithZeroCollectionsCount", "completeWithCollectionsCount"]);
  const incomplete = count(collections.unknownOrIncompleteProductCount);
  const complete = count(collections.completeProductCount);
  const zero = count(collections.completeWithZeroCollectionsCount);
  requireValue(incomplete + complete === products && zero + count(collections.completeWithCollectionsCount) === complete,
    "collection states do not partition products");
  expectedFindings.collections_unknown_or_incomplete = incomplete;
  expectedFindings.collections_complete_zero = zero;

  const freshness = object(root.freshness, ROY_CATALOG_FOUNDATION_FRESHNESS);
  for (const key of ROY_CATALOG_FOUNDATION_FRESHNESS) {
    const range = object(freshness[key], ["populationUnit", "populationCount", "timestampCount", "oldest", "newest"]);
    const isVariant = key === "variantSyncedAt";
    const population = isVariant ? variants : products;
    const timestampCount = count(range.timestampCount);
    requireValue(range.populationUnit === (isVariant ? "variant" : "product") && count(range.populationCount) === population
      && timestampCount <= population, "timestamp population");
    if (!isVariant) requireValue(timestampCount === (key === "collectionsObservedAt" ? complete : observed), "timestamp coverage");
    if (timestampCount === 0) requireValue(range.oldest === null && range.newest === null, "empty timestamp range");
    else {
      timestamp(range.oldest);
      timestamp(range.newest);
      requireValue(Date.parse(range.oldest) <= Date.parse(range.newest), "reversed timestamp range");
    }
  }

  const nonzeroCodes = ROY_CATALOG_FOUNDATION_FINDINGS.filter((code) => expectedFindings[code] > 0);
  requireValue(Array.isArray(root.findings) && root.findings.length === nonzeroCodes.length, "missing/extra findings");
  let exampleCount = 0;
  let truncated = false;
  root.findings.forEach((value, index) => {
    const finding = object(value, ["code", "scope", "affectedProductCount", "examples", "examplesTruncated"]);
    requireValue(finding.code === nonzeroCodes[index] && finding.scope === "product", "finding code/order/scope");
    const affected = count(finding.affectedProductCount);
    requireValue(affected === expectedFindings[nonzeroCodes[index]], "finding count disagrees with aggregate");
    requireValue(Array.isArray(finding.examples) && finding.examples.length <= Math.min(8, affected), "too many examples per finding");
    requireValue(finding.examplesTruncated === (finding.examples.length < affected), "incorrect finding truncation");
    truncated ||= finding.examplesTruncated as boolean;
    exampleCount += finding.examples.length;
    for (const entry of finding.examples) {
      const example = object(entry, ["productLabel", "labelSource", "representativeSku", "labelTruncated", "skuTruncated"]);
      label(example.productLabel, limits.maxProductLabelCharacters as number);
      requireValue(example.labelSource === "product_content" || example.labelSource === "variant", "label provenance");
      if (example.representativeSku !== null) label(example.representativeSku, limits.maxSkuCharacters as number);
      requireValue(typeof example.labelTruncated === "boolean" && typeof example.skuTruncated === "boolean", "label truncation flags");
      requireValue(example.representativeSku !== null || example.skuTruncated === false, "null SKU cannot be truncated");
      if (finding.code === "content_unknown") requireValue(example.labelSource === "variant", "unobserved content used as label");
    }
  });
  const evidence = object(root.evidence, ["returnedExampleCount", "truncated", "budgetLimited"]);
  requireValue(exampleCount <= 24 && count(evidence.returnedExampleCount) === exampleCount, "global evidence count");
  requireValue(evidence.truncated === truncated && typeof evidence.budgetLimited === "boolean", "evidence truncation metadata");
  requireValue(!evidence.budgetLimited || truncated, "budget-limited evidence must be truncated");
  return value as RoyCatalogFoundation;
}
