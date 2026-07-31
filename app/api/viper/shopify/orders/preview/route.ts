import { NextResponse } from "next/server";
import { requireViperAdminApiActor } from "@/lib/viper/auth/access";
import { normalizeShopifyOrderId } from "@/lib/viper/shopify/order-id";
import { ShopifyOrderClientError } from "@/lib/viper/shopify/order-client";
import { previewShopifyOrder } from "@/lib/viper/shopify/order-preview";
import type { ShopifyPreviewApiResponse } from "@/lib/viper/shopify/preview-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireViperAdminApiActor();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    orderId?: unknown;
  } | null;
  const orderId = normalizeShopifyOrderId(body?.orderId);
  if (!orderId) {
    return json(
      { ok: false, error: "Oppgi en gyldig Shopify Order ID.", code: "INVALID_ORDER_ID" },
      400
    );
  }

  try {
    const preview = await previewShopifyOrder(orderId);
    if (!preview) {
      return json(
        { ok: false, error: "Ordren ble ikke funnet i Shopify.", code: "ORDER_NOT_FOUND" },
        404
      );
    }
    return json({ ok: true, preview });
  } catch (error) {
    if (error instanceof ShopifyOrderClientError) {
      return json({ ok: false, error: error.message, code: error.code }, 409);
    }
    console.error("Viper Shopify-preview feilet", {
      message: error instanceof Error ? error.message : "Ukjent feil",
    });
    return json(
      { ok: false, error: "Kunne ikke forhåndsvise ordren.", code: "SHOPIFY_ERROR" },
      500
    );
  }
}

function json(body: ShopifyPreviewApiResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
