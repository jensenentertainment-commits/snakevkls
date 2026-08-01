import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runWarehouseSaleShopifyWorker } from "@/lib/warehouse-sales/shopify-worker-engine";
import { createWarehouseSaleShopifyJobStore } from "@/lib/warehouse-sales/shopify-worker-store";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.WAREHOUSE_SALES_WORKER_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await runWarehouseSaleShopifyWorker(
      createWarehouseSaleShopifyJobStore()
    );
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Lagersalg Shopify-worker feilet", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

