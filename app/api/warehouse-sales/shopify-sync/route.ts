import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import {
  getWarehouseSaleShopifyQueueSummary,
  runNextWarehouseSaleShopifyJob,
} from "@/lib/warehouse-sales/admin-shopify-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({
      summary: await getWarehouseSaleShopifyQueueSummary(),
    });
  } catch (error) {
    console.error("Kunne ikke hente Shopify-status for lagersalg", error);
    return NextResponse.json(
      { error: "Kunne ikke hente Shopify-status akkurat nå" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const auth = await requireRole(["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const result = await runNextWarehouseSaleShopifyJob();
    const summary = await getWarehouseSaleShopifyQueueSummary();
    return NextResponse.json({ result, summary });
  } catch (error) {
    console.error("Manuell Shopify-synk for lagersalg feilet", error);
    return NextResponse.json(
      { error: "Shopify kunne ikke oppdateres akkurat nå" },
      { status: 500 },
    );
  }
}
