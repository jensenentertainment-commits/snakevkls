import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { getWarehouseSale } from "@/lib/warehouse-sales/repository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["admin", "lager"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Ugyldig salgs-ID" }, { status: 400 });
  }

  try {
    const sale = await getWarehouseSale(auth.authClient, id);
    if (!sale) {
      return NextResponse.json({ error: "Bilaget finnes ikke" }, { status: 404 });
    }
    return NextResponse.json(
      { sale },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Kunne ikke hente lagersalgsbilag", error);
    return NextResponse.json(
      { error: "Kunne ikke hente bilaget" },
      { status: 500 },
    );
  }
}
