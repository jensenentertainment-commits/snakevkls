import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { listWarehouseSales } from "@/lib/warehouse-sales/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(["admin", "lager"]);
  if (!auth.ok) return auth.response;

  try {
    const sales = await listWarehouseSales(auth.authClient);
    return NextResponse.json(
      { sales },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Kunne ikke hente lagersalgshistorikk", error);
    return NextResponse.json(
      { error: "Kunne ikke hente salgshistorikken" },
      { status: 500 },
    );
  }
}
