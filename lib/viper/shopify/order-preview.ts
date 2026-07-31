import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fetchShopifyOrderForPreview,
  type ShopifyOrderPayload,
} from "@/lib/viper/shopify/order-client";
import type {
  ShopifyOrderPreview,
  ShopifyPreviewReason,
} from "@/lib/viper/shopify/preview-types";

type SnakeProduct = {
  id: string;
  sku: string | null;
  product_name: string;
  active: boolean;
  shopify_variant_id: string | null;
};

type InventoryRow = {
  id: string;
  product_id: string;
  location_id: string | null;
  quantity: number;
  is_primary: boolean;
};

type LocationRow = {
  id: string;
  code: string;
  active: boolean;
};

function reason(
  code: ShopifyPreviewReason["code"],
  message: string,
  lineId?: string
): ShopifyPreviewReason {
  return { code, message, ...(lineId ? { lineId } : {}) };
}

export async function previewShopifyOrder(orderId: string): Promise<ShopifyOrderPreview | null> {
  const order = await fetchShopifyOrderForPreview(orderId);
  if (!order) return null;

  const variantIds = [
    ...new Set(
      order.lineItems.nodes
        .map((line) => line.variant?.id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const supabase = getSupabaseAdmin();
  const { data: productsData, error: productsError } = variantIds.length
    ? await supabase
        .from("products")
        .select("id, sku, product_name, active, shopify_variant_id")
        .in("shopify_variant_id", variantIds)
    : { data: [] as SnakeProduct[], error: null };
  if (productsError) throw new Error("Kunne ikke kontrollere produkter i Snake.");

  const products = (productsData ?? []) as SnakeProduct[];
  const productIds = products.map((product) => product.id);
  const { data: inventoryData, error: inventoryError } = productIds.length
    ? await supabase
        .from("inventory")
        .select("id, product_id, location_id, quantity, is_primary")
        .in("product_id", productIds)
    : { data: [] as InventoryRow[], error: null };
  if (inventoryError) throw new Error("Kunne ikke kontrollere lager i Snake.");

  const inventory = (inventoryData ?? []) as InventoryRow[];
  const locationIds = [
    ...new Set(
      inventory
        .map((row) => row.location_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: locationsData, error: locationsError } = locationIds.length
    ? await supabase
        .from("locations")
        .select("id, code, active")
        .in("id", locationIds)
    : { data: [] as LocationRow[], error: null };
  if (locationsError) throw new Error("Kunne ikke kontrollere lokasjoner i Snake.");

  return evaluateOrder(
    order,
    products,
    inventory,
    (locationsData ?? []) as LocationRow[]
  );
}

export function evaluateOrder(
  order: ShopifyOrderPayload,
  products: SnakeProduct[],
  inventory: InventoryRow[],
  locations: LocationRow[]
): ShopifyOrderPreview {
  const orderReasons: ShopifyPreviewReason[] = [];
  if (order.cancelledAt) orderReasons.push(reason("ORDER_CANCELLED", "Ordren er kansellert."));
  if (order.closed) orderReasons.push(reason("ORDER_CLOSED", "Ordren er lukket."));
  if (!order.fulfillable) {
    orderReasons.push(reason("ORDER_NOT_FULFILLABLE", "Ordren kan ikke oppfylles i Shopify."));
  }
  if (!["PAID", "AUTHORIZED"].includes(order.displayFinancialStatus ?? "")) {
    orderReasons.push(
      reason("PAYMENT_NOT_ELIGIBLE", "Betalingsstatus må være betalt eller autorisert.")
    );
  }
  if (!["UNFULFILLED", "PARTIALLY_FULFILLED"].includes(order.displayFulfillmentStatus ?? "")) {
    orderReasons.push(
      reason("FULFILLMENT_NOT_ELIGIBLE", "Ordren har ingen støttet uoppfylt status.")
    );
  }
  if (order.lineItems.pageInfo.hasNextPage) {
    orderReasons.push(reason("ORDER_TOO_LARGE", "Ordren har mer enn 100 varelinjer."));
  }

  const pickableLines = order.lineItems.nodes.filter(
    (line) => line.unfulfilledQuantity > 0
  );
  if (pickableLines.length === 0) {
    orderReasons.push(reason("NOTHING_TO_PICK", "Ordren har ingen uoppfylte varer å plukke."));
  }

  const productByVariant = new Map(
    products.map((product) => [product.shopify_variant_id, product])
  );
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const seenTargets = new Set<string>();

  const lines = pickableLines.map((line) => {
    const reasons: ShopifyPreviewReason[] = [];
    const variantId = line.variant?.id ?? null;
    const product = variantId ? productByVariant.get(variantId) : undefined;

    if (!line.requiresShipping) {
      reasons.push(reason("NON_PHYSICAL_LINE", "Varelinjen er ikke en fysisk vare.", line.id));
    }
    if (!variantId) {
      reasons.push(reason("VARIANT_MISSING", "Varelinjen mangler Shopify Variant ID.", line.id));
    } else if (!product) {
      reasons.push(
        reason("PRODUCT_NOT_FOUND", "Shopify-varianten finnes ikke i Snake.", line.id)
      );
    }
    if (product && !product.active) {
      reasons.push(reason("PRODUCT_INACTIVE", "Produktet er deaktivert i Snake.", line.id));
    }

    const shopifySku = (line.variant?.sku ?? line.sku)?.trim() || null;
    if (
      product &&
      shopifySku &&
      product.sku &&
      shopifySku.toLowerCase() !== product.sku.trim().toLowerCase()
    ) {
      reasons.push(
        reason("SKU_MISMATCH", "SKU stemmer ikke mellom Shopify og Snake.", line.id)
      );
    }

    const rows = product
      ? inventory.filter((row) => row.product_id === product.id)
      : [];
    if (product && rows.length === 0) {
      reasons.push(reason("INVENTORY_MISSING", "Produktet mangler lagerpost i Snake.", line.id));
    }

    const activeRows = rows.filter((row) => {
      if (!row.location_id) return false;
      return locationById.get(row.location_id)?.active === true;
    });
    if (rows.length > 0 && rows.every((row) => !row.location_id)) {
      reasons.push(reason("LOCATION_MISSING", "Produktet mangler lokasjon.", line.id));
    } else if (rows.length > 0 && activeRows.length === 0) {
      reasons.push(reason("LOCATION_INACTIVE", "Produktet mangler aktiv lokasjon.", line.id));
    }

    const sufficient = activeRows.filter(
      (row) => row.quantity >= line.unfulfilledQuantity
    );
    const primary = sufficient.filter((row) => row.is_primary);
    const selected =
      primary.length === 1
        ? primary[0]
        : primary.length === 0 && sufficient.length === 1
          ? sufficient[0]
          : null;

    if (activeRows.length > 0 && sufficient.length === 0) {
      reasons.push(
        reason(
          "INSUFFICIENT_PHYSICAL_STOCK",
          `Ikke nok fysisk beholdning til ${line.unfulfilledQuantity} stk.`,
          line.id
        )
      );
    } else if (sufficient.length > 0 && !selected) {
      reasons.push(
        reason("PICK_LOCATION_AMBIGUOUS", "Plukklokasjon kan ikke velges entydig.", line.id)
      );
    }

    if (selected && product) {
      const target = `${product.id}:${selected.id}`;
      if (seenTargets.has(target)) {
        reasons.push(
          reason(
            "DUPLICATE_PICK_TARGET",
            "Flere Shopify-linjer peker til samme produkt og lokasjon.",
            line.id
          )
        );
      }
      seenTargets.add(target);
    }

    return {
      lineId: line.id,
      title: line.title,
      variantTitle: line.variantTitle,
      sku: shopifySku,
      requestedQuantity: line.unfulfilledQuantity,
      variantId,
      productName: product?.product_name ?? null,
      snakeSku: product?.sku ?? null,
      locationCode:
        selected?.location_id
          ? locationById.get(selected.location_id)?.code ?? null
          : null,
      availableQuantity: selected?.quantity ?? null,
      importable: reasons.length === 0,
      reasons,
    };
  });

  const lineReasons = lines.flatMap((line) => line.reasons);
  return {
    order: {
      id: order.id,
      legacyResourceId: order.legacyResourceId,
      name: order.name,
      createdAt: order.createdAt,
      financialStatus: order.displayFinancialStatus,
      fulfillmentStatus: order.displayFulfillmentStatus,
    },
    importable: orderReasons.length === 0 && lineReasons.length === 0,
    reasons: [...orderReasons, ...lineReasons],
    lines,
  };
}
