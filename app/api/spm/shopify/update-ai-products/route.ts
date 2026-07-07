import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { updateAiProducts } from "@/lib/spm/shopify/update-ai-products";
import { saveSpmStatus } from "@/lib/spm/status";

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["admin"]);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));

    const limit =
      body.limit !== undefined &&
      body.limit !== null &&
      body.limit !== ""
        ? Number(body.limit)
        : undefined;

    const result = await updateAiProducts(limit);

    await saveSpmStatus({
      shopifyAi: result,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("SPM update AI products feilet:", error);

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