import { NextResponse, type NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { quoteWarehouseSale } from "@/lib/warehouse-sales/repository";
import {
  normalizeWarehouseSaleLines,
  WarehouseSaleValidationError,
} from "@/lib/warehouse-sales/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "user"]);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as { lines?: unknown };
    const lines = normalizeWarehouseSaleLines(body.lines);
    const quote = await quoteWarehouseSale(auth.authClient, lines);
    return NextResponse.json(
      { quote },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof WarehouseSaleValidationError) {
      return NextResponse.json(
        { error: error.message, failureKind: "rejected" },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Ugyldig forespørsel", failureKind: "rejected" },
        { status: 400 },
      );
    }
    console.error("Kunne ikke beregne lagersalgskurv", error);
    return NextResponse.json(
      { error: "Kunne ikke kontrollere kurven akkurat nå" },
      { status: 500 },
    );
  }
}
