import fs from "fs/promises";
import path from "path";
import { shopifyGraphql } from "@/lib/shopify/shopify-admin";

const FIND_PRODUCT_BY_SKU_QUERY = `
  query FindProductBySku($query: String!) {
    productVariants(first: 20, query: $query) {
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

type ShopifyProductResult = {
  variantId: string;
  sku: string | null;
  productId: string;
  productTitle: string;
  productHandle: string;
  productStatus: string;
  featuredImageUrl: string | null;
};

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

async function findInLocalIndex(sku: string) {
  try {
    const indexFile = path.join(
      process.cwd(),
      "spm-output",
      "shopify-product-index.json"
    );

    const index = JSON.parse(
      await fs.readFile(indexFile, "utf8")
    ) as Record<string, ShopifyProductResult>;

    return index[sku] ?? null;
  } catch {
    return null;
  }
}

export async function findProductBySku(sku: string) {
  const normalizedSku = sku.trim();

  

  if (!normalizedSku) {
    return null;
  }

  const indexedProduct = await findInLocalIndex(normalizedSku);

  if (indexedProduct) {
    return indexedProduct;
  }

  const searchSku =
    normalizedSku.split("-").length > 2
      ? normalizedSku.split("-").slice(0, 2).join("-")
      : normalizedSku;

  const data = await shopifyGraphql<ShopifyFindProductBySkuResponse>({
    query: FIND_PRODUCT_BY_SKU_QUERY,
    variables: {
      query: `sku:${searchSku}`,
    },
  });

  const variants = data.productVariants.edges.map((edge) => edge.node);

  const variant = variants.find(
    (item) => item.sku?.trim() === normalizedSku
  );

  if (!variant) {
    return null;
  }

  return {
    variantId: variant.id,
    sku: variant.sku,
    productId: variant.product.id,
    productTitle: variant.product.title,
    productHandle: variant.product.handle,
    productStatus: variant.product.status,
    featuredImageUrl: variant.product.featuredImage?.url ?? null,
  };
}