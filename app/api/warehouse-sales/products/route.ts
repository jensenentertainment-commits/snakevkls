import { NextResponse, type NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { searchWarehouseSaleProducts } from "@/lib/warehouse-sales/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireRole(["admin", "lager"]);
  if (!auth.ok) return auth.response;

  try {
    const products = await searchWarehouseSaleProducts(
      auth.authClient,
      request.nextUrl.searchParams.get("q") ?? "",
    );
    return NextResponse.json(
      { products },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Kunne ikke søke etter produkter for lagersalg", error);
    return NextResponse.json(
      { error: "Kunne ikke hente produkter akkurat nå" },
      { status: 500 },
    );
  }
}
