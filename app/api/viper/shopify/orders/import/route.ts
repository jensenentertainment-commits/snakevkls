import { NextResponse } from "next/server";
import { requireViperAdminApiActor } from "@/lib/viper/auth/access";
import { normalizeShopifyOrderId } from "@/lib/viper/shopify/order-id";
import { ShopifyOrderClientError } from "@/lib/viper/shopify/order-client";
import {
  materializeFreshShopifyOrder,
  ViperShopifyImportError,
} from "@/lib/viper/shopify/order-materialization";
import type { ShopifyImportApiResponse } from "@/lib/viper/shopify/preview-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireViperAdminApiActor();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    orderId?: unknown;
    previewUpdatedAt?: unknown;
  } | null;
  const orderId = normalizeShopifyOrderId(body?.orderId);
  const previewUpdatedAt =
    typeof body?.previewUpdatedAt === "string" ? body.previewUpdatedAt.trim() : "";
  if (!orderId || !previewUpdatedAt || !Number.isFinite(Date.parse(previewUpdatedAt))) {
    return json(
      { ok: false, error: "Ugyldig ordre eller forhåndsvisning.", code: "INVALID_ORDER_ID" },
      400
    );
  }

  try {
    const result = await materializeFreshShopifyOrder(
      orderId,
      previewUpdatedAt,
      auth.actor,
      crypto.randomUUID()
    );
    return json({ ok: true, result });
  } catch (error) {
    if (error instanceof ViperShopifyImportError) {
      return json({ ok: false, error: error.message, code: error.code }, 409);
    }
    if (error instanceof ShopifyOrderClientError) {
      return json({ ok: false, error: error.message, code: error.code }, 409);
    }
    console.error("Viper Shopify-import feilet", {
      message: error instanceof Error ? error.message : "Ukjent feil",
    });
    return json(
      { ok: false, error: "Kunne ikke importere ordren.", code: "MATERIALIZATION_FAILED" },
      500
    );
  }
}

function json(body: ShopifyImportApiResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
