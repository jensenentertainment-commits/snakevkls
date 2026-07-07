import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { findProductBySku } from "@/lib/spm/shopify/find-product-by-sku";

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  const sku = String(body.sku || "").trim();

  if (!sku) {
    return NextResponse.json(
      { error: "Mangler SKU" },
      { status: 400 }
    );
  }

  const product = await findProductBySku(sku);

  return NextResponse.json({
    found: Boolean(product),
    product,
  });
}