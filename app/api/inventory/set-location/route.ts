import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  productId: string;
  inventoryId?: string | null;
  zoneId?: string | null;
  locationId?: string | null;
  quantity: number;
};

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "user", "warehouse"]);
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  const supabaseAdmin = getSupabaseAdmin();
  const body = (await request.json()) as Body;
  const productId = String(body.productId ?? "").trim();
  const inventoryId = body.inventoryId || null;
  const zoneId = body.zoneId || null;
  const locationId = body.locationId || null;
  const quantity = Number(body.quantity);

  if (!productId) {
    return NextResponse.json({ error: "Mangler produkt" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json({ error: "Ugyldig antall" }, { status: 400 });
  }
  if (!zoneId && !locationId) {
    return NextResponse.json(
      { error: "Velg minst sone eller lokasjon" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.rpc("set_product_location", {
    requested_product_id: productId,
    requested_inventory_id: inventoryId,
    requested_zone_id: zoneId,
    requested_location_id: locationId,
    requested_quantity: quantity,
    requested_actor_id: user.id,
    requested_actor_email: user.email ?? null,
    requested_actor_name: profile.display_name ?? user.email ?? null,
  });

  if (error) {
    console.error("Atomic placement update feilet", error);
    return NextResponse.json(
      { error: "Kunne ikke oppdatere plassering" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
