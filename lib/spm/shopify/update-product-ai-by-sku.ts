import fs from "fs/promises";
import path from "path";
import { shopifyGraphql } from "@/lib/shopify/shopify-admin";
import { findProductBySku } from "./find-product-by-sku";
import { addProductToCollections } from "./add-product-to-collections";

type AiProduct = {
  sku: string;
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  collections: string[];
};

const PRODUCT_UPDATE = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        title
        status
        tags
        seo {
          title
          description
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type ProductUpdateResponse = {
  productUpdate: {
    product: {
      id: string;
      title: string;
      status: string;
      tags: string[];
      seo: {
        title: string | null;
        description: string | null;
      };
    } | null;
    userErrors: {
      field: string[] | null;
      message: string;
    }[];
  };
};

function descriptionToHtml(description: string) {
  return `<p>${description}</p>`;
}

export async function updateProductAiBySku(sku: string) {
  const outputRoot = path.join(process.cwd(), "spm-output");
  const aiFile = path.join(outputRoot, "ai-products.json");

  const aiProducts = JSON.parse(
    await fs.readFile(aiFile, "utf8")
  ) as AiProduct[];

  const aiProduct = aiProducts.find(
    (item) => item.sku.trim() === sku.trim()
  );

  if (!aiProduct) {
    throw new Error(`Fant ikke AI-data for SKU ${sku}`);
  }

  const product = await findProductBySku(sku);

  if (!product) {
    throw new Error(`Fant ikke produkt i Shopify for SKU ${sku}`);
  }

  if (product.productStatus !== "DRAFT") {
    throw new Error(
      `Produktet er ikke draft: ${product.productTitle}`
    );
  }

  const data = await shopifyGraphql<ProductUpdateResponse>({
    query: PRODUCT_UPDATE,
    variables: {
      input: {
        id: product.productId,
        title: aiProduct.title,
        descriptionHtml: descriptionToHtml(aiProduct.description),
        tags: aiProduct.tags,
        seo: {
          title: aiProduct.seoTitle,
          description: aiProduct.seoDescription,
        },
      },
    },
  });

  const errors = data.productUpdate.userErrors;

  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  const collectionResults = await addProductToCollections(
  product.productId,
  aiProduct.collections ?? []
);

  return {
  sku,
  productId: product.productId,
  oldTitle: product.productTitle,
  newTitle: data.productUpdate.product?.title,
  tags: data.productUpdate.product?.tags ?? [],
  seo: data.productUpdate.product?.seo ?? null,
  collections: collectionResults,
};
}