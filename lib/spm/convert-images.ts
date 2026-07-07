import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

type Product = {
  file: string;
  sku: string;
  title: string;
  image: string;
};

const CANVAS_SIZE = 1024;
const PRODUCT_SIZE = 950;

function slugify(text: string) {
  return text
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function convertImages(limit?: number) {
  const outputRoot = path.join(process.cwd(), "spm-output");
  const productsFile = path.join(outputRoot, "products.json");
  const imagesDir = path.join(outputRoot, "images");

  const products = JSON.parse(
    await fs.readFile(productsFile, "utf8")
  ) as Product[];

  const productsToConvert = limit ? products.slice(0, limit) : products;

  await fs.mkdir(imagesDir, { recursive: true });

  let converted = 0;
  let failed = 0;

  for (const product of productsToConvert) {
    if (!product.image) {
      failed++;
      continue;
    }

    const sourcePath = path.resolve(path.dirname(product.file), product.image);

    const outputName = `${product.sku || slugify(product.title)}-${slugify(
      product.title
    )}.jpg`;

    const outputPath = path.join(imagesDir, outputName);

    try {
      await sharp(sourcePath)
        .resize(PRODUCT_SIZE, PRODUCT_SIZE, {
          fit: "inside",
        })
        .resize(CANVAS_SIZE, CANVAS_SIZE, {
          fit: "contain",
          background: "#ffffff",
        })
        .jpeg({
          quality: 82,
          mozjpeg: true,
        })
        .toFile(outputPath);

      converted++;
    } catch {
      failed++;
    }
  }

  return {
    total: productsToConvert.length,
    converted,
    failed,
    imagesDir,
  };
}