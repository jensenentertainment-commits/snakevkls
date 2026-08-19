import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = { locationId: string; locationCode: string; sku: string; quantity: number };

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "user", "warehouse"]);
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  const supabaseAdmin = getSupabaseAdmin();
  const body = (await request.json()) as Body;
  const locationId = String(body.locationId ?? "").trim();
  const sku = String(body.sku ?? "").trim();
  const quantity = Number(body.quantity);

  if (!locationId) {
    return NextResponse.json({ error: "Mangler lokasjon" }, { status: 400 });
  }
  if (!sku) {
    return NextResponse.json({ error: "Skriv inn SKU" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json(
      { error: "Antall må være 0 eller høyere" },
      { status: 400 }
    );
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id")
    .ilike("sku", sku)
    .maybeSingle();

  if (productError) {
    return NextResponse.json({ error: "Kunne ikke finne produkt" }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json(
      { error: `Fant ingen produkt med SKU: ${sku}` },
      { status: 404 }
    );
  }

  const { data, error } = await supabaseAdmin.rpc("add_product_to_location", {
    requested_product_id: product.id,
    requested_location_id: locationId,
    requested_quantity: quantity,
    requested_actor_id: user.id,
    requested_actor_email: user.email ?? null,
    requested_actor_name: profile.display_name ?? user.email ?? null,
  });

  if (error) {
    console.error("Atomic add-to-location feilet", error);
    return NextResponse.json(
      { error: "Kunne ikke legge til produkt" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
