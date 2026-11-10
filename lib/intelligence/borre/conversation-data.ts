import { readStockTable, type ReadPage, type Table } from "./stock-reader.ts";
import { normalizeProductKey, type StockData, type Product, type Inventory, type Location, type Zone } from "./stock-contract.ts";
import type { StockTarget } from "./conversation-route.ts";

export type StockFilter = { column: string; op: "eq" | "in" | "ilike"; value: string | string[] };
export type FilteredReadPage = (table: Table, columns: string, from: number, to: number, filter?: StockFilter) => ReturnType<ReadPage>;

/** All pages of the selected scope. No SQL strings, mutations or service credentials. */
export async function readConversationData(target: StockTarget, read: FilteredReadPage): Promise<StockData> {
  const table = (name: Table, filter?: StockFilter) => readStockTable((t, cols, from, to) => read(t, cols, from, to, filter), name);
  const byIds = async (name: Table, column: string, ids: (string | null)[]) => {
    const unique = [...new Set(ids.filter((v): v is string => v !== null))];
    const rows: unknown[] = [];
    for (let i = 0; i < unique.length; i += 100) rows.push(...await table(name, { column, op: "in", value: unique.slice(i, i + 100) }));
    return rows;
  };
  let products: Product[]; let inventory: Inventory[]; let locations: Location[];
  if (target.kind === "product") {
    const key = normalizeProductKey(target.key);
    products = await table("products", { column: key.kind === "productUuid" ? "id" : key.kind === "variantId" ? "shopify_variant_id" : "product_name",
      op: key.kind === "name" ? "ilike" : "eq",
      value: key.kind === "name" ? `%${key.value.replace(/[\\%_]/g, "\\$&")}%` : key.value }) as Product[];
    // Ambiguous search results are identities only; do not fetch every candidate's stock.
    inventory = products.length === 1 ? await byIds("inventory", "product_id", products.map(p => p.id)) as Inventory[] : [];
    locations = await byIds("locations", "id", inventory.map(r => r.location_id)) as Location[];
  } else if (target.kind === "location") {
    locations = await table("locations", { column: "code", op: "eq", value: target.code }) as Location[];
    inventory = await byIds("inventory", "location_id", locations.map(l => l.id)) as Inventory[];
    products = await byIds("products", "id", inventory.map(r => r.product_id)) as Product[];
  } else {
    inventory = await table("inventory") as Inventory[];
    products = await byIds("products", "id", inventory.map(r => r.product_id)) as Product[];
    locations = await byIds("locations", "id", inventory.map(r => r.location_id)) as Location[];
  }
  const zones = await byIds("zones", "id", [...locations.map(l => l.zone_id), ...inventory.map(r => r.zone_id)]) as Zone[];
  if (inventory.some(r => !products.some(p => p.id === r.product_id))) throw new Error("BORRE_READ_INCOMPLETE");
  return { products, inventory, locations, zones };
}
