import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = { inventoryId: string };

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager"]);
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  const body = (await request.json()) as Body;
  const inventoryId = String(body.inventoryId ?? "").trim();
  if (!inventoryId) {
    return NextResponse.json({ error: "Mangler lagerlinje" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("remove_product_from_location", {
    requested_inventory_id: inventoryId,
    requested_actor_id: user.id,
    requested_actor_email: user.email ?? null,
    requested_actor_name: profile.display_name ?? user.email ?? null,
  });

  if (error) {
    console.error("Atomic remove-from-location feilet", error);
    return NextResponse.json(
      { error: "Kunne ikke fjerne produkt fra lokasjon" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
