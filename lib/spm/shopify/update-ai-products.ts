import fs from "fs/promises";
import path from "path";
import { updateProductAiBySku } from "./update-product-ai-by-sku";

type AiProduct = {
  sku: string;
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  collections: string[];
};

export async function updateAiProducts(
  limit?: number,
  skus?: string[]
) {
  const outputRoot = path.join(process.cwd(), "spm-output");
  const aiFile = path.join(outputRoot, "ai-products.json");

  const aiProducts = JSON.parse(
    await fs.readFile(aiFile, "utf8")
  ) as AiProduct[];

const productsToProcess =
  skus && skus.length > 0
    ? aiProducts.filter((product) => skus.includes(product.sku))
    : limit && limit > 0
      ? aiProducts.slice(0, limit)
      : aiProducts;

  const results = [];

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const aiProduct of productsToProcess) {
    const sku = aiProduct.sku?.trim();

    if (!sku) {
      failed++;

      results.push({
        sku: "",
        title: aiProduct.title,
        success: false,
        skipped: false,
        error: "Mangler SKU",
      });

      continue;
    }

    try {
      const result = await updateProductAiBySku(sku);

      success++;

      results.push({
        sku,
        title: aiProduct.title,
        success: true,
        skipped: false,
        result,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Ukjent feil";

      if (message.includes("ikke draft")) {
        skipped++;

        results.push({
          sku,
          title: aiProduct.title,
          success: true,
          skipped: true,
          message,
        });

        continue;
      }

      failed++;

      results.push({
        sku,
        title: aiProduct.title,
        success: false,
        skipped: false,
        error: message,
      });
    }
  }

  return {
    total: productsToProcess.length,
    success,
    failed,
    skipped,
    results,
  };
}