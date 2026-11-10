import { getAccessDecision } from "../../auth/roles.ts";
import { locationStock, productStock, resolveProduct, type ProductKey, type StockData } from "./stock-contract.ts";

export const stockColumns = {
  products: "id,product_name,variant_name,sku,shopify_variant_id,active,shopify_quantity,shopify_inventory_tracked,shopify_inventory_location_id,shopify_inventory_observed_at",
  inventory: "id,product_id,location_id,zone_id,quantity",
  locations: "id,code,zone_id,active,location_purpose",
  zones: "id,code,name,active",
} as const;
export type Table = keyof typeof stockColumns;
export type ReadPage = (table: Table, columns: string, from: number, to: number) => Promise<{
  data: unknown[] | null; count: number | null; error: unknown;
}>;
type Identity = { authenticated: boolean; profile: { role?: unknown; active?: unknown } | null };
export type StockRequest = { kind: "product"; key: ProductKey } | { kind: "location"; locationId: string } | { kind: "invalidPlacements" };

function validRow(table: Table, value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const nullableText = (key: string) => row[key] === null || typeof row[key] === "string";
  if (typeof row.id !== "string") return false;
  if (table === "inventory") return typeof row.product_id === "string" && typeof row.quantity === "number"
    && Number.isFinite(row.quantity) && nullableText("location_id") && nullableText("zone_id");
  if (typeof row.active !== "boolean") return false;
  if (table === "products") return typeof row.product_name === "string"
    && ["variant_name", "sku", "shopify_variant_id", "shopify_inventory_location_id", "shopify_inventory_observed_at"].every(nullableText)
    && (row.shopify_inventory_tracked === null || typeof row.shopify_inventory_tracked === "boolean")
    && (row.shopify_quantity === null || (typeof row.shopify_quantity === "number" && Number.isSafeInteger(row.shopify_quantity)));
  if (typeof row.code !== "string") return false;
  return table === "zones" ? typeof row.name === "string" : nullableText("zone_id") && nullableText("location_purpose");
}

export async function readStockData(readPage: ReadPage): Promise<StockData> {
  const result: Record<string, unknown[]> = {};
  for (const table of Object.keys(stockColumns) as Table[]) {
    result[table] = await readStockTable(readPage, table);
  }
  const data = result as StockData;
  if (data.inventory.some(r => !data.products.some(p => p.id === r.product_id))) throw new Error("BORRE_READ_INCOMPLETE");
  return data;
}

/** Shared pagination/validation for complete, filtered read sets as well. */
export async function readStockTable(readPage: ReadPage, table: Table): Promise<unknown[]> {
    const rows: unknown[] = [];
    const ids = new Set<string>();
    let expected: number | null = null;
    do {
      const page = await readPage(table, stockColumns[table], rows.length, rows.length + 499);
      if (page.error || !page.data || page.count === null || !Number.isSafeInteger(page.count) || page.count < 0 || page.count > 100000
        || (expected !== null && expected !== page.count)) throw new Error("BORRE_READ_INCOMPLETE");
      expected = page.count;
      for (const row of page.data) {
        if (!validRow(table, row)) throw new Error("BORRE_READ_INVALID_DATA");
        const id = (row as { id: string }).id;
        if (ids.has(id)) throw new Error("BORRE_READ_CHANGED");
        ids.add(id);
        rows.push(row);
      }
      if (rows.length > expected || (page.data.length === 0 && rows.length < expected)) throw new Error("BORRE_READ_INCOMPLETE");
    } while (rows.length < expected);
    return rows;
}

/** Internal seam for synthetic tests; production callers use readBorreStock in stock-server. */
export async function executeStockRead(identity: Identity, readPage: ReadPage, request: StockRequest) {
  if (getAccessDecision({ ...identity, allowedRoles: ["admin", "user", "warehouse"] }) !== "allowed") throw new Error("BORRE_READ_FORBIDDEN");
  const startedAt = new Date().toISOString();
  const data = await readStockData(readPage);
  const metadata = { source: "stored_snake_data", startedAt, finishedAt: new Date().toISOString(),
    coverage: "all_visible_rows", consistency: "non_atomic_read_window", physicalRegistration: "incomplete_or_unknown" } as const;
  if (request.kind === "product") {
    const match = resolveProduct(data, request.key);
    return { metadata, result: { ...match, stock: match.status === "resolved" ? productStock(data, match.candidates[0].productUuid) : null } };
  }
  if (request.kind === "location") return { metadata, result: locationStock(data, request.locationId) };
  if (request.kind !== "invalidPlacements") throw new Error("INVALID_STOCK_REQUEST");
  return { metadata, result: data.products.flatMap(p => productStock(data, p.id).positiveInvalidPlacements) };
}
