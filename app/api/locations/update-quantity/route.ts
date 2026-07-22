import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = { inventoryId: string; quantity: number };

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager"]);
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  const supabaseAdmin = getSupabaseAdmin();
  const body = (await request.json()) as Body;
  const inventoryId = String(body.inventoryId ?? "").trim();
  const quantity = Number(body.quantity);

  if (!inventoryId) {
    return NextResponse.json({ error: "Mangler lagerlinje" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json(
      { error: "Antall må være 0 eller høyere" },
      { status: 400 }
    );
  }

  const { data: inventory, error: inventoryError } = await supabaseAdmin
    .from("inventory")
    .select("quantity")
    .eq("id", inventoryId)
    .single();
  if (inventoryError || !inventory) {
    return NextResponse.json({ error: "Fant ikke lagerlinje" }, { status: 404 });
  }

  const previousQuantity = inventory.quantity ?? 0;
  const quantityDelta = quantity - previousQuantity;
  if (quantityDelta === 0) {
    return NextResponse.json({
      ok: true,
      inventoryId,
      previousQuantity,
      newQuantity: quantity,
    });
  }

  const { data, error } = await supabaseAdmin.rpc("apply_stock_movement", {
    requested_inventory_id: inventoryId,
    requested_quantity_delta: quantityDelta,
    requested_reason: "correction",
    requested_note: "Antall oppdatert fra lokasjonssiden",
    expected_quantity: previousQuantity,
    requested_actor_id: user.id,
    requested_actor_email: user.email ?? null,
    requested_actor_name: profile.display_name ?? user.email ?? null,
  });

  if (error) {
    const conflict = error.message.includes("changed concurrently");
    return NextResponse.json(
      { error: conflict ? "Beholdningen ble endret samtidig. Last siden på nytt." : "Kunne ikke oppdatere antall" },
      { status: conflict ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
