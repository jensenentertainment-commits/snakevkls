import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { buildShopifyProductIndex } from "@/lib/spm/shopify/build-shopify-product-index";

export async function POST() {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const result = await buildShopifyProductIndex();

  return NextResponse.json(result);
}