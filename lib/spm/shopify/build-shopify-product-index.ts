import fs from "fs/promises";
import path from "path";
import { shopifyGraphql } from "@/lib/shopify/shopify-admin";

const QUERY = `
  query ProductVariants($cursor: String) {
    productVariants(first: 250, after: $cursor) {
      edges {
        cursor
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
      pageInfo {
        hasNextPage
      }
    }
  }
`;

type VariantNode = {
  id: string;
  sku: string | null;
  product: {
    id: string;
    title: string;
    handle: string;
    status: string;
    featuredImage: { url: string } | null;
  };
};

type ShopifyProductVariantsResponse = {
  productVariants: {
    edges: {
      cursor: string;
      node: VariantNode;
    }[];
    pageInfo: {
      hasNextPage: boolean;
    };
  };
};

export async function buildShopifyProductIndex() {
  const outputRoot = path.join(process.cwd(), "spm-output");
  const outputFile = path.join(outputRoot, "shopify-product-index.json");

  const index: Record<string, unknown> = {};

  let cursor: string | null = null;
  let hasNextPage = true;
  let count = 0;

 while (hasNextPage) {
  const data: ShopifyProductVariantsResponse =
    await shopifyGraphql<ShopifyProductVariantsResponse>({
      query: QUERY,
      variables: cursor ? { cursor } : {},
    });

  const edges = data.productVariants.edges;

  for (const edge of edges) {
    const variant = edge.node;
    const sku = variant.sku?.trim();

    if (!sku) continue;

    index[sku] = {
      variantId: variant.id,
      sku,
      productId: variant.product.id,
      productTitle: variant.product.title,
      productHandle: variant.product.handle,
      productStatus: variant.product.status,
      featuredImageUrl: variant.product.featuredImage?.url ?? null,
    };

    count++;
  }

  hasNextPage = data.productVariants.pageInfo.hasNextPage;

  const lastEdge = edges[edges.length - 1];
  cursor = lastEdge?.cursor ?? null;
}

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(index, null, 2), "utf8");

  return {
    count,
    outputFile,
  };
}