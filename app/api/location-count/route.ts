import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  locationId: string;
  inventoryId: string;
  expectedQuantity: number;
  countedQuantity: number;
  note?: string | null;
};

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager"]);
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  const supabaseAdmin = getSupabaseAdmin();
  const body = (await request.json()) as Body;
  const locationId = String(body.locationId ?? "").trim();
  const inventoryId = String(body.inventoryId ?? "").trim();
  const expectedQuantity = Number(body.expectedQuantity);
  const countedQuantity = Number(body.countedQuantity);
  const note = String(body.note ?? "").trim() || null;

  if (!locationId || !inventoryId) {
    return NextResponse.json(
      { error: !locationId ? "Mangler lokasjon" : "Mangler lagerlinje" },
      { status: 400 }
    );
  }
  if (
    !Number.isInteger(expectedQuantity) ||
    !Number.isInteger(countedQuantity) ||
    expectedQuantity < 0 ||
    countedQuantity < 0
  ) {
    return NextResponse.json({ error: "Ugyldig antall" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("record_location_count", {
    requested_location_id: locationId,
    requested_inventory_id: inventoryId,
    requested_expected_quantity: expectedQuantity,
    requested_counted_quantity: countedQuantity,
    requested_note: note,
    requested_actor_id: user.id,
    requested_actor_email: user.email ?? null,
    requested_actor_name: profile.display_name ?? user.email ?? null,
  });

  if (error) {
    console.error("Atomic location count feilet", error);
    const conflict = error.message.includes("changed before count");
    return NextResponse.json(
      {
        error: conflict
          ? "Beholdningen ble endret før tellingen ble lagret"
          : "Kunne ikke lagre telling",
      },
      { status: conflict ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, count: data });
}
