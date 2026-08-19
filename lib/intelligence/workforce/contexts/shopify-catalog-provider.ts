import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ValidChatInput } from "../../shared/chat-input";
import type { ContextProvider } from "../context-provider";
import {
  ROY_RECEIVED_CATALOG_FIELDS,
  type ShopifyCatalogContext,
} from "./shopify-catalog";

const RESULT_LIMIT = 24;

function searchTerm(input: ValidChatInput) {
  const quoted = /["“]([^"”]{2,80})["”]/u.exec(input.question)?.[1];
  if (quoted) return quoted.trim();

  const sku = /\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/u.exec(input.question)?.[0];
  if (sku) return sku;

  const vendor = /\bfra\s+([\p{L}\p{N}-]+(?:\s+[\p{L}\p{N}-]+)?)/iu.exec(
    input.question,
  )?.[1];
  if (vendor) return vendor.trim();

  const words = input.question.match(/[\p{L}\p{N}-]+/gu) ?? [];
  return words.length <= 4 ? words.join(" ") : "";
}

export const shopifyCatalogProvider = {
  id: "shopify.catalog",
  capabilityId: "shopify.read_catalog",
  async provide(_context, input) {
    const supabase = await createClient();
    const query = searchTerm(input);
    let productsQuery = supabase
      .from("products")
      .select("id, sku, product_name, vendor, product_type, shopify_status, shopify_price_minor, shopify_price_currency, shopify_quantity, synced_at")
      .eq("active", true)
      .not("shopify_product_id", "is", null)
      .order("synced_at", { ascending: false })
      .limit(RESULT_LIMIT);

    if (query) {
      const filters = query.split(/\s+/).flatMap((term) => {
        const pattern = `%${term}%`;
        return [
          `product_name.ilike.${pattern}`,
          `sku.ilike.${pattern}`,
          `vendor.ilike.${pattern}`,
          `product_type.ilike.${pattern}`,
        ];
      });
      productsQuery = productsQuery.or(filters.join(","));
    }

    const { data: products, error: productsError } = await productsQuery;
    if (productsError) throw new Error(`Catalog query failed: ${productsError.message}`);

    const ids = (products ?? []).map((product) => product.id);
    const { data: collections, error: collectionsError } = ids.length
      ? await supabase
          .from("product_collections")
          .select("product_id, title, handle")
          .in("product_id", ids)
          .order("title")
      : { data: [], error: null };
    if (collectionsError) throw new Error(`Collection query failed: ${collectionsError.message}`);

    return {
      query,
      scope: "targeted_catalog_sample",
      resultLimit: RESULT_LIMIT,
      receivedFields: ROY_RECEIVED_CATALOG_FIELDS,
      products: (products ?? []).map((product) => ({
        sku: product.sku,
        productName: product.product_name,
        vendor: product.vendor,
        productType: product.product_type,
        status: product.shopify_status,
        priceMinor: product.shopify_price_minor,
        currency: product.shopify_price_currency,
        quantity: product.shopify_quantity,
        collections: (collections ?? [])
          .filter((collection) => collection.product_id === product.id)
          .map(({ title, handle }) => ({ title, handle })),
      })),
      limitations: [
        `Maksimalt ${RESULT_LIMIT} synkroniserte, aktive varianter er med per forespørsel.`,
        "Snake-katalogen inneholder ikke produktbeskrivelse, SEO-felt eller full bildegalleri i v1.",
        "Resultatet er en observasjon av sist synkroniserte data, ikke live Shopify-data.",
        "Et felt som ikke inngår i utvalget kan ikke behandles som manglende i Shopify.",
      ],
    } satisfies ShopifyCatalogContext;
  },
} satisfies ContextProvider<ShopifyCatalogContext>;
