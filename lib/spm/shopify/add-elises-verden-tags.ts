import fs from "fs/promises";
import path from "path";
import { addElisesVerdenTagBySku } from "./add-elises-verden-tag-by-sku";

type EliseProduct = {
  sku?: string;
  title?: string;
};

type TagResult =
  | {
      sku: string;
      title: string;
      success: true;
      result: {
        sku: string;
        productId: string;
        productTitle: string;
        tag: string;
      };
    }
  | {
      sku: string;
      title: string;
      success: false;
      error: string;
    };

export async function addElisesVerdenTags(
  limit?: number,
  selectedSkus?: string[]
) {
  const productsFile = path.join(
    process.cwd(),
    "spm-output",
    "products.json"
  );

  const rawProducts = await fs.readFile(productsFile, "utf8");

  const products = JSON.parse(rawProducts) as EliseProduct[];

  if (!Array.isArray(products)) {
    throw new Error("products.json inneholder ikke en produktliste");
  }

  const normalizedSelectedSkus = selectedSkus
    ?.map((sku) => sku.trim())
    .filter(Boolean);

  const productsToProcess =
    normalizedSelectedSkus && normalizedSelectedSkus.length > 0
      ? products.filter((product) =>
          normalizedSelectedSkus.includes(product.sku?.trim() ?? "")
        )
      : limit && limit > 0
        ? products.slice(0, limit)
        : products;

  const results: TagResult[] = [];

  let success = 0;
  let failed = 0;

  for (const product of productsToProcess) {
    const sku = product.sku?.trim() ?? "";
    const title = product.title?.trim() ?? "";

    if (!sku) {
      failed++;

      results.push({
        sku: "",
        title,
        success: false,
        error: "Mangler SKU",
      });

      continue;
    }

    try {
      const result = await addElisesVerdenTagBySku(sku);

      success++;

      results.push({
        sku,
        title,
        success: true,
        result,
      });
    } catch (error) {
      failed++;

      results.push({
        sku,
        title,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Ukjent feil",
      });
    }
  }

  return {
    total: productsToProcess.length,
    success,
    failed,
    tag: "elises-verden",
    results,
  };
}