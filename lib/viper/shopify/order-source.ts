import type { ShopifyOrderPayload } from "./order-client";
import type { ShopifyPreviewReason } from "./preview-types";

// Shopify eligibility only. Physical stock and location selection belong to SQL.
export function sourceReasons(order: ShopifyOrderPayload): ShopifyPreviewReason[] {
  const reasons: ShopifyPreviewReason[] = [];
  const add = (code: ShopifyPreviewReason["code"], message: string, lineId?: string) =>
    reasons.push({ code, message, ...(lineId ? { lineId } : {}) });
  if (order.sourceName !== "web" || order.app?.id !== "gid://shopify/App/580111")
    add("ORDER_ORIGIN_NOT_ALLOWED", "Viper behandler kun nettordre fra Online Store. POS, Zettle og ukjent opprinnelse er ikke tillatt.");
  if (order.cancelledAt) add("ORDER_CANCELLED", "Ordren er kansellert.");
  if (order.closed) add("ORDER_CLOSED", "Ordren er lukket.");
  if (!order.fulfillable) add("ORDER_NOT_FULFILLABLE", "Ordren kan ikke oppfylles i Shopify.");
  if (!["PAID", "AUTHORIZED"].includes(order.displayFinancialStatus ?? ""))
    add("PAYMENT_NOT_ELIGIBLE", "Betalingsstatus må være betalt eller autorisert.");
  if (!["UNFULFILLED", "PARTIALLY_FULFILLED"].includes(order.displayFulfillmentStatus ?? ""))
    add("FULFILLMENT_NOT_ELIGIBLE", "Ordren har ingen støttet uoppfylt status.");
  if (order.lineItems.pageInfo.hasNextPage) add("ORDER_TOO_LARGE", "Ordren har mer enn 100 varelinjer.");
  const lines = order.lineItems.nodes.filter(line => line.unfulfilledQuantity > 0);
  if (!lines.length) add("NOTHING_TO_PICK", "Ordren har ingen uoppfylte varer å plukke.");
  for (const line of lines) {
    if (!line.requiresShipping) add("NON_PHYSICAL_LINE", "Varelinjen er ikke en fysisk vare.", line.id);
    if (!line.variant?.id) add("VARIANT_MISSING", "Varelinjen mangler Shopify Variant ID.", line.id);
  }
  return reasons;
}

export function sourceLines(order: ShopifyOrderPayload) {
  return order.lineItems.nodes.filter(line => line.unfulfilledQuantity > 0).map((line, index) => ({
    externalLineId: line.id,
    shopifyVariantId: line.variant?.id ?? null,
    sku: (line.variant?.sku ?? line.sku)?.trim() || null,
    productName: line.title,
    variantName: line.variantTitle,
    requestedQuantity: line.unfulfilledQuantity,
    sequenceNumber: index + 1,
  }));
}
