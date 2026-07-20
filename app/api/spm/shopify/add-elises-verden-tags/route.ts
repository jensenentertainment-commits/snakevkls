import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { addElisesVerdenTags } from "@/lib/spm/shopify/add-elises-verden-tags";

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["admin"]);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));

    const parsedLimit =
      body.limit !== undefined &&
      body.limit !== null &&
      body.limit !== ""
        ? Number(body.limit)
        : undefined;

    const limit =
      parsedLimit !== undefined &&
      Number.isFinite(parsedLimit) &&
      parsedLimit > 0
        ? Math.floor(parsedLimit)
        : undefined;

    const skus = Array.isArray(body.skus)
      ? body.skus
          .map((sku: unknown) => String(sku).trim())
          .filter(Boolean)
      : undefined;

    const result = await addElisesVerdenTags(limit, skus);

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "SPM add Elises Verden tags feilet:",
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