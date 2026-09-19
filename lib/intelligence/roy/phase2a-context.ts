import type { ValidChatInput } from "../shared/chat-input.ts";
import { resolveMostRecentConversationReference } from "../shared/conversational-reference.ts";
import { parseRoyCatalogFoundation, type RoyCatalogFoundation } from "./catalog-foundation-contract.ts";
import { parseRoyTargetedContent, TARGET_FIELDS, type RoyTargetedContent, type TargetField } from "./targeted-content-contract.ts";

export type Phase2aRoute =
  | { kind: "targeted"; sku: string }
  | { kind: "foundation"; field: TargetField | "collections" | null }
  | { kind: "clarify" | "unsupported" | "capabilities" | "legacy" };
export type Phase2aContext =
  | { source: "roy_targeted_product_v1"; receivedFields: readonly string[]; data: RoyTargetedContent }
  | { source: "roy_catalog_foundation_v1"; receivedFields: readonly string[]; field: TargetField | "collections" | null; data: RoyCatalogFoundation }
  | { source: "roy_phase2a_guidance_v1"; receivedFields: readonly string[]; reason: "clarify" | "unsupported" | "capabilities" };

export const TARGET_RECEIVED_FIELDS = ["selectedVariant", "siblingVariants", ...TARGET_FIELDS.map(f => `productContent.${f}`),
  "productContent.contentObservedAt", "productContent.shopifyUpdatedAt", "productContent.persistedAt", "canonicalCollections", "generatedAt"] as const;

export function requestedContentField(q: string): TargetField | "collections" | null {
  if (/seo.?beskrivelse|metabeskrivelse|meta description|seo description/iu.test(q)) return "seoDescriptionOverride";
  if (/seo|metatittel|meta title/iu.test(q)) return "seoTitleOverride";
  if (/beskrivelse|produkttekst|description/iu.test(q)) return "description";
  if (/product category|shopify.?kategori|taksonomi/iu.test(q)) return "shopifyCategory";
  if (/produkttype|product.?type/iu.test(q)) return "productType";
  if (/handle|\burl\b/iu.test(q)) return "productHandle";
  if (/bildereferanse|image.?reference|featured.?image/iu.test(q)) return "imageReference";
  if (/collection|kolleksjon/iu.test(q)) return "collections";
  if (/produktnavn|product.?name/iu.test(q)) return "productName";
  return null;
}
function skus(text: string): string[] {
  // Preserve the established hyphenated-SKU extraction and user-history priority.
  // Explicit "SKU X" also supports non-hyphenated real SKUs.
  const named = [...text.matchAll(/\bSKU\s+([\p{L}\p{N}][\p{L}\p{N}_.-]*)/giu)].map(m => m[1].replace(/[.,]+$/u, ""));
  return [...new Set([...named, ...(text.match(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/gu) ?? [])])];
}
export function resolvePhase2aRoute(input: ValidChatInput): Phase2aRoute {
  const q = input.question;
  const field = requestedContentField(q);
  const catalog = /katalog|hvor mange\s+(?:aktive\s+)?(?:produkter|varianter)|hvilke produkter/iu.test(q);
  const qualityOnly = /kvalitet|dårlig|god\b|rangering|optimaliser|søkevolum|keyword|relevans|riktig kategor/iu.test(q);
  const factual = /\bhar\b|\bhvilken\b|mangler|registrert|observert|komplett|dekning|hvor mange/iu.test(q);
  if (catalog) {
    if (qualityOnly && (!factual || /dårlig|god\b|kvalitet|rangering|optimaliser/iu.test(q))) return { kind: "unsupported" };
    // Existing audits/legacy collection searches retain their own source/meaning.
    if (/duplikat|inkonsisten|mangler sku|prioriter|audit/iu.test(q)) return { kind: "legacy" };
    if (field === "collections" && /ligger i|matcher/iu.test(q)) return { kind: "legacy" };
    if (/komplett|dekning|observert|hvor mange|foundation/iu.test(q)
      || (field !== null && field !== "productType" && field !== "imageReference")) return { kind: "foundation", field };
    return { kind: "legacy" };
  }
  const explicit = skus(q);
  if (explicit.length > 1) return { kind: "clarify" };
  if (explicit.length === 1) return { kind: "targeted", sku: explicit[0] };
  if (/\b(dette|det|denne|den|produktet|varen)\b/iu.test(q)) {
    const ref = resolveMostRecentConversationReference({ history: input.history, extract: skus, key: s => s });
    return ref.status === "resolved" ? { kind: "targeted", sku: ref.value } : { kind: "clarify" };
  }
  if (/hva kan du|hvilke felt|hva mangler du/iu.test(q)) return { kind: "capabilities" };
  if (qualityOnly) return { kind: "unsupported" };
  // These established missing-type/collection searches remain legacy.
  if (field === "productType" || field === "collections" || field === "imageReference") return { kind: "legacy" };
  if (field !== null) return { kind: "clarify" };
  return { kind: "legacy" };
}

export type Phase2aReadRpc = (name: "get_roy_targeted_product_v1" | "get_roy_catalog_foundation_v1", args?: { requested_sku: string }) => Promise<{ data: unknown; error: unknown }>;
export async function readPhase2aContext(route: Exclude<Phase2aRoute, { kind: "legacy" }>, rpc: Phase2aReadRpc): Promise<Phase2aContext> {
  if (route.kind === "targeted") {
    const result = await rpc("get_roy_targeted_product_v1", { requested_sku: route.sku });
    if (result.error) throw new Error("Roy targeted retrieval failed");
    const data = parseRoyTargetedContent(result.data);
    return { source: "roy_targeted_product_v1", receivedFields: data.status === "found" ? TARGET_RECEIVED_FIELDS : [], data };
  }
  if (route.kind === "foundation") {
    const result = await rpc("get_roy_catalog_foundation_v1");
    if (result.error) throw new Error("Roy catalog foundation retrieval failed");
    return { source: "roy_catalog_foundation_v1", receivedFields: ["catalogFoundation"], field: route.field, data: parseRoyCatalogFoundation(result.data) };
  }
  if (route.kind === "legacy") throw new Error("Legacy route is not a Phase 2A read");
  return { source: "roy_phase2a_guidance_v1", receivedFields: [], reason: route.kind };
}

/** Validate/project again at the model boundary. Do not spread raw context. */
export function phase2aModelContext(c: Phase2aContext): Phase2aContext {
  if (c.source === "roy_targeted_product_v1") {
    const data = parseRoyTargetedContent(c.data);
    return { source: c.source, receivedFields: data.status === "found" ? TARGET_RECEIVED_FIELDS : [], data };
  }
  if (c.source === "roy_catalog_foundation_v1") return { source: c.source, receivedFields: ["catalogFoundation"], field: c.field, data: parseRoyCatalogFoundation(c.data) };
  return { source: "roy_phase2a_guidance_v1", receivedFields: [], reason: c.reason };
}
