import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { attachProductImages } from "@/lib/spm/shopify/attach-product-images";
import { saveSpmStatus } from "@/lib/spm/status";

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["admin"]);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();

    const limit =
      body.limit !== undefined &&
      body.limit !== null &&
      body.limit !== ""
        ? Number(body.limit)
        : undefined;

    const result =
      await attachProductImages(limit);

      await saveSpmStatus({ shopifyImages: result });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ukjent feil",
      },
      {
        status: 500,
      }
    );
  }
}