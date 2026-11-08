import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

// Reject old clients rather than creating placements without a location.
export async function POST() {
  const auth = await requireRole(["admin", "user", "warehouse"]);
  if (!auth.ok) return auth.response;
  return NextResponse.json(
    { error: "Soneplassering er avsluttet. Velg en konkret lokasjon for varen." },
    { status: 410 }
  );
}
