import fs from "fs/promises";
import * as cheerio from "cheerio";
import fg from "fast-glob";
import path from "path";

export type ParsedProduct = {
  file: string;
  category: string;
  title: string;
  sku: string;
  price: string;
  inventory: string;
  image: string;
  description: string;
};

function clean(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function toPrice(text: string) {
  const match = text.match(/[\d\s]+(?:,\d{2})?/);
  if (!match) return "";
  return match[0].replace(/\s/g, "").replace(",", ".");
}

export async function parseProducts(importPath: string) {
  const normalizedImportPath = importPath.replaceAll("\\", "/");

  const allHtml = await fg(`${normalizedImportPath}/**/*.html`, {
    onlyFiles: true,
    dot: true,
  });

  const productFiles = allHtml.filter((file) => {
    const normalized = file.replaceAll("\\", "/");

    return (
      normalized.includes("/produkt/") &&
      !normalized.includes("{3}") &&
      !normalized.endsWith("/produkt/index.html")
    );
  });

  const products: ParsedProduct[] = [];

  for (const file of productFiles) {
    const html = await fs.readFile(file, "utf8");
    const $ = cheerio.load(html);

    const normalized = file.replaceAll("\\", "/");
    const parts = normalized.split("/");
    const category = parts[parts.indexOf("produkt") + 1];

    const title =
      clean($(".product__title").first().text()) ||
      clean($("h1").first().text());

    const sku = clean($(".product__art-nr").first().text());
    const description = clean($(".product__ingress").first().text());

    const inventory =
      clean($(".product__stockstatus__number").first().text()).match(/(\d+)/)
        ?.[1] ?? "";

    const priceText =
      clean($(".product__price").first().text()) ||
      clean($(".price").first().text()) ||
      clean($("body").text()).match(/PrisNOK\s*[\d\s]+,\d{2}/i)?.[0] ||
      "";

    const price = toPrice(priceText);

    const image =
      $("img")
        .map((_, img) => $(img).attr("src") || "")
        .get()
        .find((src) => src.includes("assets/img/640/640/bilder_nettbutikk")) ??
      "";

    products.push({
      file,
      category,
      title,
      sku,
      price,
      inventory,
      image,
      description,
    });
  }

  const outputDir = path.join(process.cwd(), "spm-output");
  await fs.mkdir(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, "products.json");

  await fs.writeFile(outputFile, JSON.stringify(products, null, 2), "utf8");

  return {
    products: products.length,
    outputFile,
    examples: products.slice(0, 5),
  };
}