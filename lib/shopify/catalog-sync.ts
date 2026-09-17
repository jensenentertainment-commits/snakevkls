import type { ProductCollectionObservation } from "../intelligence/roy/product-content-contract.ts";

// Bound the nested connection cost: 20 variants x 20 initial collections.
// Remaining membership is fetched once per unique product by catalog-source.
export const SHOPIFY_CATALOG_QUERY = `
  query ProductVariants($cursor: String, $locationId: ID!) {
    shop {
      currencyCode
    }
    location(id: $locationId) {
      id
      name
      isActive
    }
    productVariants(
      first: 20
      after: $cursor
      query: "product_status:active"
      sortKey: ID
    ) {
      edges {
        cursor
        node {
          id
          sku
          title
          price
          inventoryItem {
            id
            tracked
            inventoryLevel(locationId: $locationId) {
              id
              quantities(names: ["available"]) {
                name
                quantity
              }
            }
          }
          product {
            id
            updatedAt
            title
            status
            vendor
            productType
            description
            seo {
              title
              description
            }
            handle
            category {
              id
              fullName
            }
            featuredImage {
              url
            }
            collections(first: 20, sortKey: ID) {
              edges {
                node {
                  id
                  title
                  handle
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export type ShopifyCollectionNode = {
  id: string;
  title: string;
  handle: string | null;
};

export type ShopifyCollectionConnection = {
  edges: { node: ShopifyCollectionNode }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

export type ShopifyProductContentPayload = {
  shopifyProductId: string;
  shopifyUpdatedAt: string;
  contentObservedAt: string;
  productName: string;
  description: string;
  seoTitle: string | null;
  seoDescription: string | null;
  productHandle: string;
  productType: string | null;
  shopifyCategory: {
    id: string;
    fullName: string;
  } | null;
  vendor: string | null;
  status: string;
  imageReference: string | null;
};

export type ShopifyVariantNode = {
  id: string;
  sku: string | null;
  title: string;
  price: string;
  inventoryItem: {
    id: string;
    tracked: boolean;
    inventoryLevel: {
      id: string;
      quantities: { name: string; quantity: number }[];
    } | null;
  };
  product: {
    id: string;
    updatedAt: string;
    title: string;
    status: string;
    vendor: string | null;
    productType: string | null;
    description: string;
    seo: {
      title: string | null;
      description: string | null;
    };
    handle: string;
    category: {
      id: string;
      fullName: string;
    } | null;
    featuredImage: { url: string } | null;
    collections: ShopifyCollectionConnection;
  };
};

export type ShopifyVariantPayload = {
  sku: string | null;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  vendor: string | null;
  productType: string | null;
  shopifyPriceMinor: number;
  shopifyPriceCurrency: string;
  shopifyQuantity: number | null;
  shopifyInventoryTracked: boolean;
  shopifyInventoryLevelId: string | null;
  shopifyInventoryLocationId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  shopifyInventoryItemId: string;
  shopifyStatus: string;
  collections: ShopifyCollectionNode[];
  collectionObservation: Extract<ProductCollectionObservation, { state: "complete" }>;
  productContent: ShopifyProductContentPayload;
};

export function mapShopifyProductContent(
  product: ShopifyVariantNode["product"],
  contentObservedAt: string,
): ShopifyProductContentPayload {
  // Missing source keys are UNKNOWN, not an observed null/empty value.
  const nullableString = (value: unknown) => value === null || typeof value === "string";
  if (!product || [product.id, product.title, product.status, product.description, product.handle]
    .some((value) => typeof value !== "string") ||
    !nullableString(product.vendor) || !nullableString(product.productType) ||
    !product.seo || !nullableString(product.seo.title) || !nullableString(product.seo.description) ||
    (product.category !== null && (!product.category ||
      typeof product.category.id !== "string" || typeof product.category.fullName !== "string")) ||
    (product.featuredImage !== null && (!product.featuredImage || typeof product.featuredImage.url !== "string"))) {
    throw new Error("Shopify product content observation is missing source fields");
  }
  for (const timestamp of [product.updatedAt, contentObservedAt]) {
    if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) {
      throw new Error("Shopify product content requires valid source and observation timestamps");
    }
  }
  return {
    shopifyProductId: product.id,
    shopifyUpdatedAt: product.updatedAt,
    contentObservedAt,
    productName: product.title,
    description: product.description,
    seoTitle: product.seo.title,
    seoDescription: product.seo.description,
    productHandle: product.handle,
    productType: product.productType,
    shopifyCategory: product.category
      ? { id: product.category.id, fullName: product.category.fullName }
      : null,
    vendor: product.vendor,
    status: product.status,
    imageReference: product.featuredImage?.url ?? null,
  };
}

export function validateShopifyLocation(
  location: { id: string; name: string; isActive: boolean } | null | undefined,
  expectedLocationId: string
) {
  if (!location || location.id !== expectedLocationId) {
    throw new Error("Shopify-lokasjonen for Snake-lageret finnes ikke");
  }

  if (!location.isActive) {
    throw new Error(`Shopify-lokasjonen ${location.name} er ikke aktiv`);
  }
}

export function parseShopifyMoneyToMinor(amount: string): number {
  const normalized = amount.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);

  if (!match) {
    throw new Error(`Ugyldig Shopify-pris: ${amount}`);
  }

  const whole = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const minor = whole * 100 + Number(fraction || "0");

  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Shopify-prisen er for stor: ${amount}`);
  }

  return minor;
}

export function mapShopifyVariant(
  variant: ShopifyVariantNode,
  input: {
    currencyCode: string;
    locationId: string;
    contentObservedAt: string;
    collectionObservation: Extract<ProductCollectionObservation, { state: "complete" }>;
  }
): ShopifyVariantPayload {
  // The legacy relation writer replaces membership. Never hand it partial data.
  if (input.collectionObservation.state !== "complete") {
    throw new Error("Shopify collection membership is not complete");
  }
  const currencyCode = input.currencyCode.trim().toUpperCase();

  if (currencyCode !== "NOK") {
    throw new Error(
      `Lagersalg V1 krever NOK som Shopify-valuta, fikk ${currencyCode || "ukjent"}`
    );
  }

  const available = variant.inventoryItem.inventoryLevel?.quantities.find(
    (quantity) => quantity.name === "available"
  );

  return {
    sku: variant.sku?.trim() || null,
    productName: variant.product.title,
    variantName: variant.title === "Default Title" ? null : variant.title,
    imageUrl: variant.product.featuredImage?.url ?? null,
    vendor: variant.product.vendor ?? null,
    productType: variant.product.productType ?? null,
    shopifyPriceMinor: parseShopifyMoneyToMinor(variant.price),
    shopifyPriceCurrency: currencyCode,
    shopifyQuantity: available?.quantity ?? null,
    shopifyInventoryTracked: variant.inventoryItem.tracked,
    shopifyInventoryLevelId:
      variant.inventoryItem.inventoryLevel?.id ?? null,
    shopifyInventoryLocationId: input.locationId,
    shopifyProductId: variant.product.id,
    shopifyVariantId: variant.id,
    shopifyInventoryItemId: variant.inventoryItem.id,
    shopifyStatus: variant.product.status,
    collections: [...input.collectionObservation.collections],
    collectionObservation: input.collectionObservation,
    productContent: mapShopifyProductContent(variant.product, input.contentObservedAt),
  };
}
