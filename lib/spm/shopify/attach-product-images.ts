import fs from "fs/promises";
import path from "path";
import { attachProductImageBySku } from "./attach-product-image";
import { findProductBySku } from "./find-product-by-sku";

type Product = {
  sku: string;
  title: string;
};

export async function attachProductImages(limit?: number) {
  const outputRoot = path.join(process.cwd(), "spm-output");
  const productsFile = path.join(outputRoot, "products.json");
  const imagesDir = path.join(outputRoot, "images");

  const products = JSON.parse(
    await fs.readFile(productsFile, "utf8")
  ) as Product[];

  const productsToProcess =
    limit && limit > 0 ? products.slice(0, limit) : products;

  const imageFiles = await fs.readdir(imagesDir);

  const results = [];
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const productItem of productsToProcess) {
    const sku = productItem.sku?.trim();

    if (!sku) {
      failed++;
      results.push({
        sku: "",
        title: productItem.title,
        success: false,
        skipped: false,
        error: "Produkt mangler SKU",
      });
      continue;
    }

    const file = imageFiles.find((imageFile) => {
  const lower = imageFile.toLowerCase();
  const skuLower = sku.toLowerCase();

  return (
    lower.startsWith(`${skuLower}-`) ||
    lower.startsWith(skuLower) ||
    lower.includes(skuLower)
  );
});

    if (!file) {
      failed++;
      results.push({
        sku,
        title: productItem.title,
        success: false,
        skipped: false,
        error: "Fant ikke bilde lokalt",
      });
      continue;
    }

    const imagePath = path.join(imagesDir, file);

    try {
      const product = await findProductBySku(sku);

      if (!product) {
        failed++;
        results.push({
          sku,
          title: productItem.title,
          file,
          success: false,
          skipped: false,
          error: "Fant ikke produkt i Shopify",
        });
        continue;
      }

      if (product.featuredImageUrl) {
        skipped++;
        results.push({
          sku,
          title: productItem.title,
          file,
          success: true,
          skipped: true,
          message: "Produktet har allerede bilde",
        });
        continue;
      }

      const result = await attachProductImageBySku(sku);

      success++;

      results.push({
        sku,
        title: productItem.title,
        file,
        imagePath,
        success: true,
        skipped: false,
        result,
      });
    } catch (error) {
      failed++;

      results.push({
        sku,
        title: productItem.title,
        file,
        imagePath,
        success: false,
        skipped: false,
        error: error instanceof Error ? error.message : "Ukjent feil",
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