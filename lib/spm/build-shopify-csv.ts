import fs from "fs/promises";
import path from "path";
import { stringify } from "csv-stringify/sync";

type Product = {
  title: string;
  description: string;
  category: string;
  sku: string;
  price: string;
  inventory: string;
};

const DISCOUNT_FACTOR = 0.6;
const COST = 12;

function slugify(text: string) {
  return text
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function outletPrice(value: number) {
  const rounded = Math.round(value);

  if (rounded < 100) {
    return (Math.floor(rounded / 10) * 10 + 9).toString();
  }

  return (Math.round(rounded / 10) * 10).toString();
}

export async function buildShopifyCsv(limit?: number) {
  const outputRoot = path.join(process.cwd(), "spm-output");

  const products = JSON.parse(
    await fs.readFile(path.join(outputRoot, "products.json"), "utf8")
  ) as Product[];

  const productsToExport =
    limit && limit > 0 ? products.slice(0, limit) : products;

  const rows = productsToExport.map((product) => {
    const oldPrice = Number(product.price || 0);
    const newPrice = oldPrice * DISCOUNT_FACTOR;

    return {
      Handle: product.sku
  ? `${slugify(product.title)}-${slugify(product.sku)}`
  : slugify(product.title),
      Title: product.title,
      "Body (HTML)": `<p>${product.description}</p>`,
      Vendor: "Varekompaniet",
      Type: product.category,
      Tags: "Migrert",
      Published: "FALSE",

      "Option1 Name": "Title",
      "Option1 Value": "Default Title",

      "Variant SKU": product.sku,
      "Variant Inventory Tracker": "shopify",
      "Variant Inventory Qty": Number(product.inventory || "0"),
      "Variant Inventory Policy": "deny",
      "Variant Fulfillment Service": "manual",

      "Variant Price": outletPrice(newPrice),
      "Variant Compare At Price": Math.round(oldPrice).toString(),
      "Cost per item": COST.toString(),

      "Variant Requires Shipping": "TRUE",
      "Variant Taxable": "TRUE",

      Status: "draft",
    };
  });

  const csv = stringify(rows, {
    header: true,
  });

  const outputFile = path.join(outputRoot, "shopify-products.csv");

  await fs.writeFile(outputFile, csv, "utf8");

  return {
    products: rows.length,
    outputFile,
  };
}