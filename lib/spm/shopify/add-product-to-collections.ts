import { shopifyGraphql } from "@/lib/shopify/shopify-admin";

const FIND_COLLECTION_BY_TITLE = `
  query FindCollectionByTitle($query: String!) {
    collections(first: 20, query: $query) {
      edges {
        node {
          id
          title
          handle
        }
      }
    }
  }
`;

const COLLECTION_ADD_PRODUCTS = `
  mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type FindCollectionResponse = {
  collections: {
    edges: {
      node: {
        id: string;
        title: string;
        handle: string;
      };
    }[];
  };
};

type CollectionAddProductsResponse = {
  collectionAddProducts: {
    collection: {
      id: string;
      title: string;
    } | null;
    userErrors: {
      field: string[] | null;
      message: string;
    }[];
  };
};

function normalize(text: string) {
  return text.trim().toLowerCase();
}

async function findCollectionByTitle(title: string) {
  const data = await shopifyGraphql<FindCollectionResponse>({
    query: FIND_COLLECTION_BY_TITLE,
    variables: {
      query: title,
    },
  });

  const matches = data.collections.edges.map((edge) => edge.node);

  console.log("Collection search", {
    searchTitle: title,
    matches: matches.map((collection) => collection.title),
  });

  return (
    matches.find(
      (collection) => normalize(collection.title) === normalize(title)
    ) ?? null
  );
}

export async function addProductToCollections(
  productId: string,
  collectionTitles: string[]
) {
  const uniqueTitles = [...new Set(collectionTitles.filter(Boolean))];
  const results = [];

  for (const title of uniqueTitles) {
    const collection = await findCollectionByTitle(title);

    if (!collection) {
      console.log("Fant ikke collection", {
        title,
        productId,
      });

      results.push({
        title,
        success: false,
        error: "Fant ikke collection i Shopify",
      });

      continue;
    }

    const data = await shopifyGraphql<CollectionAddProductsResponse>({
      query: COLLECTION_ADD_PRODUCTS,
      variables: {
        id: collection.id,
        productIds: [productId],
      },
    });

    const errors = data.collectionAddProducts.userErrors;

    console.log("Collection add result", {
      title,
      shopifyTitle: collection.title,
      collectionId: collection.id,
      productId,
      errors,
    });

    if (errors.length > 0) {
      results.push({
        title,
        success: false,
        error: errors.map((e) => e.message).join(", "),
      });

      continue;
    }

    results.push({
      title,
      success: true,
      collectionId: collection.id,
      shopifyTitle: collection.title,
    });
  }

  return results;
}