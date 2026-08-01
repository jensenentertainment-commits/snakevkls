import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

import type {
  CartLineInput,
  CartQuote,
  WarehouseSaleDocument,
  WarehouseSaleProduct,
  WarehouseSaleSummary,
} from "./ui-adapter/types";

type ProductRow = {
  id: string;
  sku: string | null;
  product_name: string;
  variant_name: string | null;
  image_url: string | null;
  active: boolean;
  shopify_price_minor: number | null;
  shopify_price_currency: string | null;
  shopify_inventory_tracked: boolean | null;
  shopify_inventory_level_id: string | null;
  shopify_inventory_item_id: string | null;
  shopify_inventory_location_id: string | null;
  inventory: Array<{ quantity: number }>;
};

type SaleRow = {
  id: string;
  sale_number: string;
  completed_at: string;
  completed_by_name: string;
  payment_method: string;
  total_amount_minor: number;
  total_quantity: number;
  warehouse_sale_lines: Array<{
    line_number: number;
    sku: string | null;
    product_name: string;
    variant_name: string | null;
    quantity: number;
    unit_price_minor: number;
    line_total_minor: number;
  }>;
};

function safeSearchTerm(value: string) {
  return value
    .trim()
    .slice(0, 120)
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ");
}

function sumPhysicalInventory(product: ProductRow) {
  return product.inventory.reduce(
    (total, inventory) => total + inventory.quantity,
    0,
  );
}

function safeProductImage(imageUrl: string | null) {
  if (!imageUrl) return "/snake2.png";
  try {
    const url = new URL(imageUrl);
    return url.protocol === "https:" && url.hostname === "cdn.shopify.com"
      ? imageUrl
      : "/snake2.png";
  } catch {
    return "/snake2.png";
  }
}

function mapProduct(
  product: ProductRow,
  configuredLocationId: string | null,
): WarehouseSaleProduct {
  const availableQuantity = sumPhysicalInventory(product);
  let availability: WarehouseSaleProduct["availability"];

  if (
    !configuredLocationId ||
    product.shopify_inventory_location_id !== configuredLocationId
  ) {
    availability = {
      status: "unavailable",
      availableQuantity,
      reason: "Ikke koblet til riktig lager",
    };
  } else if (
    product.shopify_price_minor === null ||
    product.shopify_price_currency !== "NOK"
  ) {
    availability = {
      status: "unavailable",
      availableQuantity,
      reason: "Mangler gyldig salgspris",
    };
  } else if (
    product.shopify_inventory_tracked !== true ||
    !product.shopify_inventory_item_id ||
    !product.shopify_inventory_level_id
  ) {
    availability = {
      status: "unavailable",
      availableQuantity,
      reason: "Lagerkoblingen er ikke klar",
    };
  } else if (availableQuantity <= 0) {
    availability = {
      status: "unavailable",
      availableQuantity: 0,
      reason: "Ikke på lager",
    };
  } else {
    availability = { status: "available", availableQuantity };
  }

  return {
    id: product.id,
    sku: product.sku,
    productName: product.product_name,
    variantName: product.variant_name,
    imageUrl: safeProductImage(product.image_url),
    suggestedUnitPriceMinor: product.shopify_price_minor ?? 0,
    availability,
  };
}

async function getConfiguredLocationId() {
  const shop = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  if (!shop) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("shopify_connections")
    .select("inventory_location_id")
    .eq("shop", shop)
    .maybeSingle();
  if (error) throw error;
  return (data?.inventory_location_id as string | null | undefined) ?? null;
}

const PRODUCT_COLUMNS =
  "id,sku,product_name,variant_name,image_url,active,shopify_price_minor,shopify_price_currency,shopify_inventory_tracked,shopify_inventory_level_id,shopify_inventory_item_id,shopify_inventory_location_id,inventory(quantity)";

export async function searchWarehouseSaleProducts(
  authClient: SupabaseClient,
  rawQuery: string,
) {
  const query = safeSearchTerm(rawQuery);
  let request = authClient
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("active", true)
    .order("product_name")
    .limit(40);

  if (query) {
    const pattern = `%${query}%`;
    request = request.or(
      `product_name.ilike.${pattern},variant_name.ilike.${pattern},sku.ilike.${pattern}`,
    );
  }

  const [{ data, error }, configuredLocationId] = await Promise.all([
    request,
    getConfiguredLocationId(),
  ]);
  if (error) throw error;

  return ((data ?? []) as unknown as ProductRow[]).map((product) =>
    mapProduct(product, configuredLocationId),
  );
}

export async function quoteWarehouseSale(
  authClient: SupabaseClient,
  lines: CartLineInput[],
): Promise<CartQuote> {
  if (lines.length === 0) {
    return { lines: [], itemCount: 0, totalMinor: 0, canComplete: false };
  }

  const productIds = [...new Set(lines.map((line) => line.productId))];
  const [{ data, error }, configuredLocationId] = await Promise.all([
    authClient.from("products").select(PRODUCT_COLUMNS).in("id", productIds),
    getConfiguredLocationId(),
  ]);
  if (error) throw error;

  const products = new Map(
    ((data ?? []) as unknown as ProductRow[]).map((product) => [
      product.id,
      mapProduct(product, configuredLocationId),
    ]),
  );
  const quotedLines = lines.map((line) => {
    const product = products.get(line.productId);
    const fallbackProduct: WarehouseSaleProduct = {
      id: line.productId,
      sku: null,
      productName: "Produktet er ikke lenger tilgjengelig",
      variantName: null,
      imageUrl: "/snake2.png",
      suggestedUnitPriceMinor: 0,
      availability: {
        status: "unavailable",
        availableQuantity: 0,
        reason: "Produktet er ikke lenger tilgjengelig",
      },
    };
    const resolvedProduct = product ?? fallbackProduct;
    let lineError: string | null = null;

    if (resolvedProduct.availability.status === "unavailable") {
      lineError = resolvedProduct.availability.reason;
    } else if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > resolvedProduct.availability.availableQuantity
    ) {
      lineError = `Kun ${resolvedProduct.availability.availableQuantity} på lager`;
    } else if (
      !Number.isSafeInteger(line.unitPriceMinor) ||
      line.unitPriceMinor < 0
    ) {
      lineError = "Oppgi en gyldig pris";
    }

    return {
      ...line,
      product: resolvedProduct,
      standardUnitPriceMinor: resolvedProduct.suggestedUnitPriceMinor,
      priceOverridden:
        line.unitPriceMinor !== resolvedProduct.suggestedUnitPriceMinor,
      lineTotalMinor: line.quantity * line.unitPriceMinor,
      error: lineError,
    };
  });

  return {
    lines: quotedLines,
    itemCount: quotedLines.reduce((total, line) => total + line.quantity, 0),
    totalMinor: quotedLines.reduce(
      (total, line) => total + line.lineTotalMinor,
      0,
    ),
    canComplete:
      quotedLines.length > 0 && quotedLines.every((line) => !line.error),
  };
}

function mapSaleDocument(sale: SaleRow): WarehouseSaleDocument {
  return {
    id: sale.id,
    saleNumber: sale.sale_number,
    completedAt: sale.completed_at,
    completedByName: sale.completed_by_name,
    paymentMethod: "vipps",
    lines: [...sale.warehouse_sale_lines]
      .sort((a, b) => a.line_number - b.line_number)
      .map((line) => ({
        productName: line.product_name,
        variantName: line.variant_name,
        sku: line.sku,
        quantity: line.quantity,
        unitPriceMinor: Number(line.unit_price_minor),
        lineTotalMinor: Number(line.line_total_minor),
      })),
    itemCount: sale.total_quantity,
    totalMinor: Number(sale.total_amount_minor),
  };
}

const SALE_DOCUMENT_COLUMNS =
  "id,sale_number,completed_at,completed_by_name,payment_method,total_amount_minor,total_quantity,warehouse_sale_lines(line_number,sku,product_name,variant_name,quantity,unit_price_minor,line_total_minor)";

export async function listWarehouseSales(
  authClient: SupabaseClient,
): Promise<WarehouseSaleSummary[]> {
  const { data, error } = await authClient
    .from("warehouse_sales")
    .select("id,sale_number,completed_at,total_amount_minor,total_quantity")
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data ?? []).map((sale) => ({
    id: sale.id,
    saleNumber: sale.sale_number,
    completedAt: sale.completed_at,
    itemCount: sale.total_quantity,
    totalMinor: Number(sale.total_amount_minor),
  }));
}

export async function getWarehouseSale(
  authClient: SupabaseClient,
  id: string,
): Promise<WarehouseSaleDocument | null> {
  const { data, error } = await authClient
    .from("warehouse_sales")
    .select(SALE_DOCUMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSaleDocument(data as unknown as SaleRow) : null;
}
