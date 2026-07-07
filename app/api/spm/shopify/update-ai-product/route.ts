import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { updateProductAiBySku } from "@/lib/spm/shopify/update-product-ai-by-sku";

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

    const result = await updateProductAiBySku(sku);

    return NextResponse.json(result);
  } catch (error) {
    console.error("SPM update AI product feilet:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ukjent feil",
      },
      { status: 500 }
    );
  }
}