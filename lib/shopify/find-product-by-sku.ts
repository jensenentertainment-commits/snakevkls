import { shopifyGraphql } from "@/lib/shopify/shopify-admin";

const FIND_PRODUCT_BY_SKU_QUERY = `
  query FindProductBySku($query: String!) {
    productVariants(first: 50, query: $query) {
      edges {
        node {
          id
          sku
          product {
            id
            title
            handle
            status
            featuredImage {
              url
            }
          }
        }
      }
    }
  }
`;

type ShopifyFindProductBySkuResponse = {
  productVariants: {
    edges: {
      node: {
        id: string;
        sku: string | null;
        product: {
          id: string;
          title: string;
          handle: string;
          status: string;
          featuredImage: {
            url: string;
          } | null;
        };
      };
    }[];
  };
};

function escapeShopifySearchValue(value: string) {
  return value.replace(/-/g, "\\-");
}

async function searchVariants(query: string) {
  const data = await shopifyGraphql<ShopifyFindProductBySkuResponse>({
    
    query: FIND_PRODUCT_BY_SKU_QUERY,
    variables: { query },
    
  });

  return data.productVariants.edges.map((edge) => edge.node);
}



export async function findProductBySku(sku: string) {
  const normalizedSku = sku.trim();

  if (!normalizedSku) {
    return null;
  }

  const queries = [
    `sku:${normalizedSku}`,
    `sku:"${normalizedSku}"`,
    `sku:${escapeShopifySearchValue(normalizedSku)}`,
    normalizedSku,
    normalizedSku.split("-").slice(0, 2).join("-"),
  ];

  for (const query of queries) {
    const variants = await searchVariants(query);

    const exact = variants.find(
      (variant) => variant.sku?.trim() === normalizedSku
    );

    if (exact) {
      return {
        variantId: exact.id,
        sku: exact.sku,
        productId: exact.product.id,
        productTitle: exact.product.title,
        productHandle: exact.product.handle,
        productStatus: exact.product.status,
        featuredImageUrl: exact.product.featuredImage?.url ?? null,
      };
    }
  }

  console.log("Fant ikke Shopify-produkt med SKU", {
    sku: normalizedSku,
    triedQueries: queries,
  });

  return null;
}