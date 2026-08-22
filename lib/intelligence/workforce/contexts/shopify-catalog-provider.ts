import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildCatalogAudit, groupCatalogVariants, type CatalogVariantRow } from "../../roy/catalog-semantics";
import { resolveRoyQueryIntent } from "../../roy/query-intent";
import type { ContextProvider } from "../context-provider";
import { ROY_RECEIVED_CATALOG_FIELDS, type ShopifyCatalogContext } from "./shopify-catalog";

const RESULT_LIMIT = 24;
const AUDIT_PAGE_SIZE = 500;
const PRODUCT_COLUMNS = "id, shopify_product_id, shopify_variant_id, sku, product_name, variant_name, vendor, product_type, shopify_status, shopify_price_minor, shopify_price_currency, shopify_quantity, image_url, synced_at, shopify_inventory_tracked, shopify_inventory_observed_at";

export const shopifyCatalogProvider = {
  id: "shopify.catalog",
  capabilityId: "shopify.read_catalog",
  async provide(_context, input) {
    const intent = resolveRoyQueryIntent(input);
    if (intent.kind === "knowledge_gap" || intent.kind === "unresolved_reference") return createContext(intent, "", [], null);
    const supabase = await createClient();

    if (intent.kind === "catalog_overview" || (intent.kind === "catalog_filter" && intent.filter.type === "missing_product_type")) {
      const rows = await readAuditRows(supabase, intent.kind === "catalog_filter");
      const allProducts = groupCatalogVariants(rows, new Map());
      const audit = buildCatalogAudit(allProducts);
      const products = intent.kind === "catalog_filter"
        ? allProducts.filter((product) => product.productType === null).slice(0, RESULT_LIMIT)
        : auditEvidence(allProducts, audit).slice(0, RESULT_LIMIT);
      return createContext(intent, "", products, audit);
    }

    let rowIds: string[] | null = null;
    if (intent.kind === "catalog_filter" && intent.filter.type === "collection") {
      let collectionQuery = supabase.from("product_collections").select("product_id").limit(RESULT_LIMIT);
      if (intent.filter.value) collectionQuery = collectionQuery.ilike("title", `%${intent.filter.value}%`);
      const { data, error } = await collectionQuery;
      if (error) throw new Error(`Collection filter failed: ${error.message}`);
      rowIds = [...new Set((data ?? []).map(({ product_id }) => product_id))];
      if (!rowIds.length) return createContext(intent, "", [], null);
    }

    let query = supabase.from("products").select(PRODUCT_COLUMNS).eq("active", true).not("shopify_product_id", "is", null).order("synced_at", { ascending: false }).limit(RESULT_LIMIT);
    if (intent.kind === "product") query = query.eq("sku", intent.sku);
    else if (rowIds) query = query.in("id", rowIds);
    const { data: initialRows, error } = await query;
    if (error) throw new Error(`Catalog query failed: ${error.message}`);
    let rows = (initialRows ?? []) as CatalogVariantRow[];

    if (intent.kind === "product" && rows[0]?.shopify_product_id) {
      const { data: siblings, error: siblingsError } = await supabase.from("products").select(PRODUCT_COLUMNS).eq("active", true).eq("shopify_product_id", rows[0].shopify_product_id).order("sku");
      if (siblingsError) throw new Error(`Variant context failed: ${siblingsError.message}`);
      rows = (siblings ?? []) as CatalogVariantRow[];
    }
    const collections = await readCollections(supabase, rows.map((row) => row.id));
    const products = groupCatalogVariants(rows, collections, intent.kind === "product" ? intent.sku : null);
    return createContext(intent, intent.kind === "product" ? intent.sku : "", products, null);
  },
} satisfies ContextProvider<ShopifyCatalogContext>;

async function readAuditRows(supabase: Awaited<ReturnType<typeof createClient>>, missingTypeOnly: boolean) {
  const rows: CatalogVariantRow[] = [];
  for (let from = 0; ; from += AUDIT_PAGE_SIZE) {
    let query = supabase.from("products").select(PRODUCT_COLUMNS).eq("active", true).not("shopify_product_id", "is", null).order("id").range(from, from + AUDIT_PAGE_SIZE - 1);
    if (missingTypeOnly) query = query.is("product_type", null);
    const { data, error } = await query;
    if (error) throw new Error(`Catalog audit failed: ${error.message}`);
    const page = (data ?? []) as CatalogVariantRow[];
    rows.push(...page);
    if (page.length < AUDIT_PAGE_SIZE) break;
  }
  return rows;
}

async function readCollections(supabase: Awaited<ReturnType<typeof createClient>>, ids: readonly string[]) {
  const result = new Map<string, { title: string; handle: string | null }[]>();
  if (!ids.length) return result;
  const { data, error } = await supabase.from("product_collections").select("product_id, title, handle").in("product_id", [...ids]).order("title");
  if (error) throw new Error(`Collection query failed: ${error.message}`);
  for (const row of data ?? []) result.set(row.product_id, [...(result.get(row.product_id) ?? []), { title: row.title, handle: row.handle }]);
  return result;
}

function auditEvidence(products: readonly ShopifyCatalogContext["products"][number][], audit: NonNullable<ShopifyCatalogContext["audit"]>) {
  const labels = new Set(audit.findings.flatMap((finding) => finding.evidence));
  return products.filter((product) => labels.has(product.sku ? `${product.productName} (SKU ${product.sku})` : product.productName));
}

function createContext(intent: ShopifyCatalogContext["intent"], query: string, products: ShopifyCatalogContext["products"], audit: ShopifyCatalogContext["audit"]): ShopifyCatalogContext {
  return {
    intent, query,
    scope: intent.kind === "knowledge_gap" || intent.kind === "unresolved_reference" ? "knowledge_gap" : intent.kind === "catalog_filter" ? "catalog_filter" : "targeted_catalog_sample",
    entityScope: intent.kind === "product" ? "variant" : "catalog",
    resultLimit: RESULT_LIMIT, receivedFields: ROY_RECEIVED_CATALOG_FIELDS, products, audit,
    limitations: [
      "Produktresultater grupperes på stabil Shopify-produktidentitet; varianter beholdes separat under produktet.",
      "Snake har kun en featured-image-referanse, ikke bildegalleri eller evidens for bildekvalitet.",
      "Synkroniseringstid er en observasjon; ingen terskel for hva som er foreldet er godkjent.",
      "Snake-katalogen inneholder ikke produktbeskrivelse eller SEO-felt i denne konteksten.",
      "Resultatet er sist synkroniserte data, ikke live Shopify-data.",
    ],
  };
}
