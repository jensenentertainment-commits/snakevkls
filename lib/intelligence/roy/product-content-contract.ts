/**
 * Phase 2A product-content domain contract.
 *
 * This file intentionally has no provider, database, or model integration. It
 * defines the semantic boundary those layers must preserve in later commits.
 */

export const ROY_PRODUCT_CONTENT_CATALOG_SCOPE =
  "active_shopify_products" as const;

export type RoyProductContentCatalogScope =
  typeof ROY_PRODUCT_CONTENT_CATALOG_SCOPE;

export type ShopifyProductCategory = {
  /** Internal stable Shopify taxonomy identity. Never render normally. */
  id: string;
  /** Human-readable taxonomy path supplied by Shopify. */
  fullName: string;
};

export type ShopifyProductContentValue = {
  productName: string;
  description: string;
  seoTitle: string | null;
  seoDescription: string | null;
  productHandle: string;
  /** Merchant-defined Shopify product type. Not a Shopify Product Category. */
  productType: string | null;
  /** Shopify Standard Product Taxonomy category. Not a product type. */
  shopifyCategory: ShopifyProductCategory | null;
  /** Fixed source field; not supplier or brand data in Varekompaniet. */
  vendor: string | null;
  status: string;
  imageReference: string | null;
  shopifyUpdatedAt: string;
};

export type ProductContentObservation =
  | {
      state: "unknown";
      observedAt: null;
      value: null;
    }
  | {
      state: "observed";
      observedAt: string;
      value: ShopifyProductContentValue;
    };

export type ShopifyProductCollection = {
  /** Internal stable Shopify collection identity. Never render normally. */
  id: string;
  title: string;
  handle: string | null;
};

export type ProductCollectionObservation =
  | {
      state: "unknown";
      observedAt: null;
      collections: readonly [];
    }
  | {
      state: "incomplete";
      observedAt: string;
      /** Bounded partial evidence. It is not an authoritative membership set. */
      collections: readonly ShopifyProductCollection[];
    }
  | {
      state: "complete";
      observedAt: string;
      /** Authoritative membership set at observedAt, including an empty set. */
      collections: readonly ShopifyProductCollection[];
    };

export type ObservedFieldState = "unknown" | "missing" | "present";

export function classifyObservedField(
  observation: Pick<ProductContentObservation, "state">,
  value: unknown,
): ObservedFieldState {
  if (observation.state !== "observed") return "unknown";

  if (
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return "missing";
  }

  return "present";
}

export function classifyCollectionMembership(
  observation: ProductCollectionObservation,
): "unknown" | "incomplete" | "none" | "present" {
  if (observation.state !== "complete") return observation.state;
  return observation.collections.length === 0 ? "none" : "present";
}
