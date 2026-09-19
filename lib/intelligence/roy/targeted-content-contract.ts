export const TARGET_FIELDS = ["productName", "description", "seoTitleOverride", "seoDescriptionOverride",
  "productHandle", "productType", "shopifyCategory", "imageReference"] as const;
export type TargetField = typeof TARGET_FIELDS[number];
export type ObservedPreview = {
  state: "unknown" | "missing" | "present";
  value: string | null;
  truncated: boolean;
  withheld: boolean;
};
export type TargetVariant = {
  sku: string | null; productName: string | null; variantName: string | null;
  priceMinor: number | null; currency: string | null; quantity: number | null;
  inventoryTracked: boolean | null; inventoryObservedAt: string | null; syncedAt: string | null;
  textTruncated: boolean;
};
export const TARGET_LIMITS = { maxCollections: 24, maxSiblings: 24, maxResponseBytes: 32768 } as const;
export const TARGET_LIMITATIONS = [
  "Snake's persisted active Shopify-linked catalog; not live Shopify verification.",
  "Last successful observations; not the result of the latest refresh attempt.",
  "SEO fields are explicit merchant overrides; missing overrides do not prove missing rendered metadata.",
  "A handle does not prove a public URL resolves. Presence is not quality or correctness.",
] as const;
export type RoyTargetedContent = {
  schemaVersion: 1; source: "roy_targeted_product_v1";
  scopeAuthority: "snake_products_active_shopify_linked";
  status: "found" | "not_found" | "ambiguous"; generatedAt: string;
  selectedVariant: TargetVariant | null;
  siblingVariants: TargetVariant[]; variantCount: number; siblingsTruncated: boolean;
  productContent: null | {
    fields: Record<TargetField, ObservedPreview>;
    contentObservedAt: string | null; shopifyUpdatedAt: string | null; persistedAt: string | null;
  };
  canonicalCollections: null | {
    state: "unknown_or_incomplete" | "complete"; observedAt: string | null;
    membershipCount: number | null; names: string[]; displayTruncated: boolean;
  };
  budgetLimited: boolean; limits: typeof TARGET_LIMITS; limitations: readonly string[];
};

function check(ok: unknown, why: string): asserts ok {
  if (!ok) throw new Error(`Invalid Roy targeted content: ${why}`);
}
function object(v: unknown, keys: readonly string[]): Record<string, unknown> {
  check(v !== null && typeof v === "object" && !Array.isArray(v), "object");
  const r = v as Record<string, unknown>;
  check(Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k)), "keys");
  return r;
}
function timestamp(v: unknown) {
  check(v === null || (typeof v === "string" && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v))), "timestamp");
}
function count(v: unknown) { check(Number.isSafeInteger(v) && (v as number) >= 0, "count"); }
function text(v: unknown, max: number) {
  check(v === null || (typeof v === "string" && Array.from(v).length <= max && !/gid:\/\/shopify\//i.test(v)
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(v)), "unsafe/long text");
}
function variant(v: unknown) {
  const r = object(v, ["sku", "productName", "variantName", "priceMinor", "currency", "quantity", "inventoryTracked", "inventoryObservedAt", "syncedAt", "textTruncated"]);
  text(r.sku, 120); text(r.productName, 240); text(r.variantName, 240); text(r.currency, 12);
  for (const key of ["priceMinor", "quantity"]) check(r[key] === null || Number.isSafeInteger(r[key]), key);
  check(r.inventoryTracked === null || typeof r.inventoryTracked === "boolean", "inventory tracking");
  check(typeof r.textTruncated === "boolean", "variant truncation");
  timestamp(r.inventoryObservedAt); timestamp(r.syncedAt);
  check(r.variantName !== "Default Title", "synthetic variant name");
}

/** Strict boundary: failure never becomes not_found, missing, or legacy data. */
export function parseRoyTargetedContent(value: unknown): RoyTargetedContent {
  const serialized = JSON.stringify(value);
  check(typeof serialized === "string" && new TextEncoder().encode(serialized).length <= 32768, "byte budget");
  const r = object(value, ["schemaVersion", "source", "scopeAuthority", "status", "generatedAt", "selectedVariant", "siblingVariants", "variantCount", "siblingsTruncated", "productContent", "canonicalCollections", "budgetLimited", "limits", "limitations"]);
  check(r.schemaVersion === 1 && r.source === "roy_targeted_product_v1" && r.scopeAuthority === "snake_products_active_shopify_linked", "version/scope");
  check(["found", "not_found", "ambiguous"].includes(r.status as string), "status");
  timestamp(r.generatedAt); check(r.generatedAt !== null, "retrieval time");
  const limits = object(r.limits, Object.keys(TARGET_LIMITS));
  for (const [k, v] of Object.entries(TARGET_LIMITS)) check(limits[k] === v, "limits");
  check(JSON.stringify(r.limitations) === JSON.stringify(TARGET_LIMITATIONS), "limitations");
  count(r.variantCount);
  check(typeof r.siblingsTruncated === "boolean" && typeof r.budgetLimited === "boolean", "bounds flags");
  check(Array.isArray(r.siblingVariants) && r.siblingVariants.length <= 24, "siblings");
  r.siblingVariants.forEach(variant);
  if (r.status !== "found") {
    check(r.selectedVariant === null && r.productContent === null && r.canonicalCollections === null && r.variantCount === 0
      && r.siblingVariants.length === 0 && !r.siblingsTruncated && !r.budgetLimited, "unresolved result");
  } else {
    variant(r.selectedVariant);
    check((r.variantCount as number) >= 1 + r.siblingVariants.length
      && r.siblingsTruncated === ((r.variantCount as number) > 1 + r.siblingVariants.length), "sibling population");
    const c = object(r.productContent, ["fields", "contentObservedAt", "shopifyUpdatedAt", "persistedAt"]);
    for (const k of ["contentObservedAt", "shopifyUpdatedAt", "persistedAt"]) timestamp(c[k]);
    check((c.contentObservedAt === null) === (c.shopifyUpdatedAt === null)
      && (c.contentObservedAt === null) === (c.persistedAt === null), "content timestamps");
    const fields = object(c.fields, TARGET_FIELDS);
    for (const name of TARGET_FIELDS) {
      const f = object(fields[name], ["state", "value", "truncated", "withheld"]);
      check(["unknown", "missing", "present"].includes(f.state as string), "field state");
      check(typeof f.truncated === "boolean" && typeof f.withheld === "boolean", "preview flags");
      text(f.value, name === "description" ? 2048 : 512);
      check((c.contentObservedAt === null) === (f.state === "unknown"), "observation state");
      if (f.state !== "present") check(f.value === null && !f.truncated && !f.withheld, "empty observation");
      else if (f.withheld) check(f.value === null && !f.truncated, "withheld preview");
      else check(typeof f.value === "string" && (f.value.trim() !== "" || f.truncated), "present preview");
    }
    const m = object(r.canonicalCollections, ["state", "observedAt", "membershipCount", "names", "displayTruncated"]);
    check(Array.isArray(m.names) && m.names.length <= 24 && typeof m.displayTruncated === "boolean", "collections");
    m.names.forEach(n => { text(n, 240); check(typeof n === "string" && n.trim() !== "", "collection name"); });
    timestamp(m.observedAt);
    if (m.state === "unknown_or_incomplete") check(m.observedAt === null && m.membershipCount === null && m.names.length === 0 && !m.displayTruncated, "incomplete is not zero");
    else {
      check(m.state === "complete" && m.observedAt !== null, "complete observation");
      count(m.membershipCount);
      check((m.membershipCount as number) >= m.names.length, "membership count");
      check(m.displayTruncated || m.membershipCount === m.names.length, "missing display flag");
      if (m.membershipCount === 0) check(!m.displayTruncated, "complete zero");
    }
  }
  return value as RoyTargetedContent;
}
