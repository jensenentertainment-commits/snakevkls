import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { attachProductImageBySku } from "@/lib/spm/shopify/attach-product-image";

export async function POST(request: Request) {
  try {
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

    const result = await attachProductImageBySku(sku);

    return NextResponse.json(result);
  } catch (error) {
    console.error("SPM attach-image feilet:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ukjent feil ved bildeimport",
      },
      { status: 500 }
    );
  }
}