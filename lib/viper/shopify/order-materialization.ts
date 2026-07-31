import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ViperActor } from "@/lib/viper/auth/access";
import {
  isViperOrderStatus,
  isViperPickJobStatus,
} from "@/lib/viper/types";
import { fetchShopifyOrderForPreview } from "@/lib/viper/shopify/order-client";
import { previewFetchedShopifyOrder } from "@/lib/viper/shopify/order-preview";
import type { ShopifyOrderImportResult } from "@/lib/viper/shopify/preview-types";

export class ViperShopifyImportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ORDER_NOT_FOUND"
      | "PREVIEW_STALE"
      | "ORDER_NOT_IMPORTABLE"
      | "MATERIALIZATION_FAILED"
  ) {
    super(message);
  }
}

export async function materializeFreshShopifyOrder(
  orderId: string,
  previewUpdatedAt: string,
  actor: ViperActor,
  correlationId: string
): Promise<ShopifyOrderImportResult> {
  const order = await fetchShopifyOrderForPreview(orderId);
  if (!order) {
    throw new ViperShopifyImportError("Ordren ble ikke funnet i Shopify.", "ORDER_NOT_FOUND");
  }
  if (order.updatedAt !== previewUpdatedAt) {
    throw new ViperShopifyImportError(
      "Ordren er endret siden forhåndsvisningen. Kontroller den på nytt.",
      "PREVIEW_STALE"
    );
  }

  const preview = await previewFetchedShopifyOrder(order);
  if (!preview.importable) {
    throw new ViperShopifyImportError(
      "Ordren oppfyller ikke lenger kravene for import.",
      "ORDER_NOT_IMPORTABLE"
    );
  }

  const lines = order.lineItems.nodes
    .filter((line) => line.unfulfilledQuantity > 0)
    .map((line, index) => ({
      externalLineId: line.id,
      shopifyVariantId: line.variant!.id,
      sku: (line.variant?.sku ?? line.sku)?.trim() || null,
      productName: line.title,
      variantName: line.variantTitle,
      requestedQuantity: line.unfulfilledQuantity,
      sequenceNumber: index + 1,
    }));

  const { data, error } = await getSupabaseAdmin().rpc(
    "materialize_viper_shopify_order",
    {
      requested_external_order_id: order.id,
      requested_order_number: order.name,
      requested_external_updated_at: order.updatedAt,
      requested_received_at: order.createdAt,
      requested_lines: lines,
      requested_actor_id: actor.id,
      requested_actor_email: actor.email,
      requested_actor_name: actor.displayName,
      requested_correlation_id: correlationId,
    }
  );

  if (error) {
    throw new ViperShopifyImportError(
      "Ordren kunne ikke materialiseres i Viper.",
      "MATERIALIZATION_FAILED"
    );
  }

  if (
    !isViperOrderStatus(data?.orderStatus) ||
    !isViperPickJobStatus(data?.pickJobStatus)
  ) {
    throw new ViperShopifyImportError(
      "Viper returnerte en ukjent ordrestatus.",
      "MATERIALIZATION_FAILED"
    );
  }

  return {
    orderId: String(data.orderId),
    pickJobId: String(data.pickJobId),
    orderNumber: String(data.orderNumber),
    orderStatus: data.orderStatus,
    pickJobStatus: data.pickJobStatus,
    lineCount: Number(data.lineCount),
    idempotent: Boolean(data.idempotent),
  };
}
