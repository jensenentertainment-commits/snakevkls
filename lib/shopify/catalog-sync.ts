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
      first: 100
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
            title
            status
            vendor
            productType
            featuredImage {
              url
            }
            collections(first: 20) {
              edges {
                node {
                  id
                  title
                  handle
                }
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
    title: string;
    status: string;
    vendor: string | null;
    productType: string | null;
    featuredImage: { url: string } | null;
    collections: { edges: { node: ShopifyCollectionNode }[] };
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
};

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
  input: { currencyCode: string; locationId: string }
): ShopifyVariantPayload {
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
    collections:
      variant.product.collections?.edges?.map((item) => item.node) ?? [],
  };
}
