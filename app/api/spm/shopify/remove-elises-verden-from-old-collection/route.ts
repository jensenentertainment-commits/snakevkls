import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { removeElisesVerdenFromOldCollection } from "@/lib/spm/shopify/remove-elises-verden-from-old-collection";

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

    const skus = Array.isArray(body.skus)
      ? body.skus
          .map((sku: unknown) => String(sku).trim())
          .filter(Boolean)
      : undefined;

    const result = await removeElisesVerdenFromOldCollection(
      limit,
      skus
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "SPM remove old collection feilet:",
      error
    );

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