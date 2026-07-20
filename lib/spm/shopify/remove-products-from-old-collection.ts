import { shopifyGraphql } from "@/lib/shopify/shopify-admin";

const OLD_COLLECTION_ID =
  "gid://shopify/Collection/496597336370";

const COLLECTION_REMOVE_PRODUCTS = `
  mutation CollectionRemoveProducts(
    $id: ID!
    $productIds: [ID!]!
  ) {
    collectionRemoveProducts(
      id: $id
      productIds: $productIds
    ) {
      job {
        id
        done
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type CollectionRemoveProductsResponse = {
  collectionRemoveProducts: {
    job: {
      id: string;
      done: boolean;
    } | null;
    userErrors: {
      field: string[] | null;
      message: string;
    }[];
  };
};

export async function removeProductsFromOldCollection(
  productIds: string[]
) {
  const uniqueProductIds = [...new Set(productIds)];

  if (uniqueProductIds.length === 0) {
    return {
      collectionId: OLD_COLLECTION_ID,
      submitted: 0,
      jobId: null,
      jobDone: true,
    };
  }

  if (uniqueProductIds.length > 250) {
    throw new Error(
      "Maks 250 produkt-ID-er kan fjernes per Shopify-kall"
    );
  }

  const data =
    await shopifyGraphql<CollectionRemoveProductsResponse>({
      query: COLLECTION_REMOVE_PRODUCTS,
      variables: {
        id: OLD_COLLECTION_ID,
        productIds: uniqueProductIds,
      },
    });

  const errors =
    data.collectionRemoveProducts.userErrors;

  if (errors.length > 0) {
    throw new Error(
      errors.map((error) => error.message).join(", ")
    );
  }

  return {
    collectionId: OLD_COLLECTION_ID,
    submitted: uniqueProductIds.length,
    jobId:
      data.collectionRemoveProducts.job?.id ?? null,
    jobDone:
      data.collectionRemoveProducts.job?.done ?? true,
  };
}