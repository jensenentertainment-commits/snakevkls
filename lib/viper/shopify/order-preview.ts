import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchShopifyOrderForPreview, type ShopifyOrderPayload } from "@/lib/viper/shopify/order-client";
import { sourceReasons, sourceLines } from "@/lib/viper/shopify/order-source";
import type { ShopifyOrderPreview, ShopifyPreviewReason, ShopifyPreviewReasonCode } from "@/lib/viper/shopify/preview-types";

const databaseReasons: Partial<Record<ShopifyPreviewReasonCode, string>> = {
  PRODUCT_NOT_FOUND: "Shopify-varianten finnes ikke i Snake.",
  PRODUCT_INACTIVE: "Produktet er deaktivert i Snake.",
  SKU_MISMATCH: "SKU stemmer ikke mellom Shopify og Snake.",
  INVENTORY_MISSING: "Produktet mangler lagerpost i Snake.",
  LOCATION_MISSING: "Produktet mangler gyldig plukklokasjon.",
  LOCATION_INACTIVE: "Produktet mangler aktiv lokasjon og sone.",
  INSUFFICIENT_PHYSICAL_STOCK: "Ingen enkeltlokasjon har tilstrekkelig fysisk beholdning.",
  PICK_LOCATION_AMBIGUOUS: "Plukklokasjon kan ikke velges entydig.",
  PICK_ORDER_MISSING: "Plukklokasjonen mangler fysisk plukkerekkefølge.",
  DUPLICATE_PICK_TARGET: "Flere ordrelinjer peker til samme lagerpost.",
};

type PreparedLine = {
  externalLineId: string; locationCode: string; availableQuantity: number;
  snakeProductName: string; snakeSku: string | null;
};

export async function previewShopifyOrder(orderId: string): Promise<ShopifyOrderPreview | null> {
  const order = await fetchShopifyOrderForPreview(orderId);
  return order ? previewFetchedShopifyOrder(order) : null;
}

export async function previewFetchedShopifyOrder(order: ShopifyOrderPayload): Promise<ShopifyOrderPreview> {
  const reasons: ShopifyPreviewReason[] = sourceReasons(order);
  let prepared: PreparedLine[] = [];
  if (!reasons.length) {
    // The same read-only resolver is called again inside the import transaction.
    const { data, error } = await getSupabaseAdmin().rpc("validate_viper_order_lines", {
      requested_lines: sourceLines(order),
    });
    if (error) {
      const code = error.message as ShopifyPreviewReasonCode;
      const message = databaseReasons[code];
      if (error.code !== "P0001" || !message) throw new Error("Kunne ikke kontrollere lagergrunnlaget i Snake.");
      const lineId = order.lineItems.nodes.find(line => line.id === error.details)?.id;
      reasons.push({ code, message, ...(lineId ? { lineId } : {}) });
    } else {
      if (!Array.isArray(data) || data.length !== sourceLines(order).length) throw new Error("Ugyldig lagerkontroll fra Snake.");
      prepared = data as PreparedLine[];
    }
  }
  const byId = new Map(prepared.map(line => [line.externalLineId, line]));
  const importable = reasons.length === 0;
  const physicalOrder = new Map(prepared.map((line, index) => [line.externalLineId, index]));
  return {
    order: { id: order.id, legacyResourceId: order.legacyResourceId, name: order.name,
      createdAt: order.createdAt, updatedAt: order.updatedAt,
      financialStatus: order.displayFinancialStatus, fulfillmentStatus: order.displayFulfillmentStatus },
    importable, reasons,
    lines: order.lineItems.nodes.filter(line => line.unfulfilledQuantity > 0)
      .toSorted((a, b) => (physicalOrder.get(a.id) ?? 0) - (physicalOrder.get(b.id) ?? 0)).map(line => {
      const selected = byId.get(line.id);
      return { lineId: line.id, title: line.title, variantTitle: line.variantTitle,
        sku: (line.variant?.sku ?? line.sku)?.trim() || null,
        requestedQuantity: line.unfulfilledQuantity, variantId: line.variant?.id ?? null,
        productName: selected?.snakeProductName ?? null, snakeSku: selected?.snakeSku ?? null,
        locationCode: selected?.locationCode ?? null, availableQuantity: selected?.availableQuantity ?? null,
        importable: importable && Boolean(selected),
        reasons: reasons.filter(reason => !reason.lineId || reason.lineId === line.id) };
    }),
  };
}
