import fs from "fs/promises";
import path from "path";
import { findProductBySku } from "./find-product-by-sku";
import { removeProductsFromOldCollection } from "./remove-products-from-old-collection";

type EliseProduct = {
  sku?: string;
  title?: string;
};

type PreparedProduct = {
  sku: string;
  title: string;
  productId: string;
  productTitle: string;
};

type FailedProduct = {
  sku: string;
  title: string;
  error: string;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function removeElisesVerdenFromOldCollection(
  limit?: number,
  selectedSkus?: string[]
) {
  const productsFile = path.join(
    process.cwd(),
    "spm-output",
    "products.json"
  );

  const rawProducts = await fs.readFile(
    productsFile,
    "utf8"
  );

  const products = JSON.parse(
    rawProducts
  ) as EliseProduct[];

  if (!Array.isArray(products)) {
    throw new Error(
      "products.json inneholder ikke en produktliste"
    );
  }

  const normalizedSelectedSkus = selectedSkus
    ?.map((sku) => sku.trim())
    .filter(Boolean);

  const productsToProcess =
    normalizedSelectedSkus &&
    normalizedSelectedSkus.length > 0
      ? products.filter((product) =>
          normalizedSelectedSkus.includes(
            product.sku?.trim() ?? ""
          )
        )
      : limit && limit > 0
        ? products.slice(0, limit)
        : products;

  const prepared: PreparedProduct[] = [];
  const failedResults: FailedProduct[] = [];

  for (const product of productsToProcess) {
    const sku = product.sku?.trim() ?? "";
    const title = product.title?.trim() ?? "";

    if (!sku) {
      failedResults.push({
        sku: "",
        title,
        error: "Mangler SKU",
      });

      continue;
    }

    try {
      const shopifyProduct =
        await findProductBySku(sku);

      if (!shopifyProduct) {
        throw new Error(
          `Fant ikke produkt i Shopify for SKU ${sku}`
        );
      }

      prepared.push({
        sku,
        title,
        productId: shopifyProduct.productId,
        productTitle:
          shopifyProduct.productTitle,
      });
    } catch (error) {
      failedResults.push({
        sku,
        title,
        error:
          error instanceof Error
            ? error.message
            : "Ukjent feil",
      });
    }
  }

  /*
   * Flere SKU-er kan i teorien peke på samme Shopify-produkt.
   * Vi fjerner derfor hvert produkt bare én gang.
   */
  const uniqueProductIds = [
    ...new Set(
      prepared.map((product) => product.productId)
    ),
  ];

  /*
   * Shopify tillater opptil 250 produkt-ID-er per kall.
   */
  const batches = chunkArray(uniqueProductIds, 250);

  const batchResults = [];

  for (const batch of batches) {
    const batchResult =
      await removeProductsFromOldCollection(batch);

    batchResults.push(batchResult);
  }

  return {
    total: productsToProcess.length,
    found: prepared.length,
    uniqueProducts: uniqueProductIds.length,
    submittedForRemoval: uniqueProductIds.length,
    failed: failedResults.length,
    collectionId:
      "gid://shopify/Collection/496597336370",
    batches: batchResults.length,
    batchResults,
    failedResults,
  };
}