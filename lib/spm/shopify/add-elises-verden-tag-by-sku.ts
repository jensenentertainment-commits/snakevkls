import { shopifyGraphql } from "@/lib/shopify/shopify-admin";
import { findProductBySku } from "./find-product-by-sku";

const ELISES_VERDEN_TAG = "elises-verden";

const ADD_TAGS_MUTATION = `
  mutation AddTags($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type TagsAddResponse = {
  tagsAdd: {
    node: {
      id: string;
    } | null;
    userErrors: {
      field: string[] | null;
      message: string;
    }[];
  };
};

export async function addElisesVerdenTagBySku(sku: string) {
  const normalizedSku = sku.trim();

  if (!normalizedSku) {
    throw new Error("Mangler SKU");
  }

  const product = await findProductBySku(normalizedSku);

  if (!product) {
    throw new Error(
      `Fant ikke produkt i Shopify for SKU ${normalizedSku}`
    );
  }

  const data = await shopifyGraphql<TagsAddResponse>({
    query: ADD_TAGS_MUTATION,
    variables: {
      id: product.productId,
      tags: [ELISES_VERDEN_TAG],
    },
  });

  const errors = data.tagsAdd.userErrors;

  if (errors.length > 0) {
    throw new Error(
      errors.map((error) => error.message).join(", ")
    );
  }

  if (!data.tagsAdd.node) {
    throw new Error(
      `Shopify returnerte ikke produkt etter tagging av SKU ${normalizedSku}`
    );
  }

  return {
    sku: normalizedSku,
    productId: product.productId,
    productTitle: product.productTitle,
    tag: ELISES_VERDEN_TAG,
  };
}