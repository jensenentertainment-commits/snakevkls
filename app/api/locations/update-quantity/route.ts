import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

type Body = {
  inventoryId: string;
  quantity: number;
};

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager"]);

if (!auth.ok) return auth.response;

const { user, profile } = auth;

 

  const body = (await request.json()) as Body;
  const inventoryId = body.inventoryId;
  const quantity = Number(body.quantity);

  if (!inventoryId) {
    return NextResponse.json({ error: "Mangler lagerlinje" }, { status: 400 });
  }

  if (Number.isNaN(quantity) || quantity < 0) {
    return NextResponse.json(
      { error: "Antall må være 0 eller høyere" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  const supabaseAdmin = createSupabaseAdminClient(
    supabaseUrl,
    supabaseServiceKey
  );

  const { data: inventory, error: inventoryError } = await supabaseAdmin
    .from("inventory")
    .select(`
      id,
      quantity,
      product_id,
      location_id,
      products (
        id,
        product_name
      ),
      locations (
        id,
        code
      )
    `)
    .eq("id", inventoryId)
    .single();

  if (inventoryError || !inventory) {
    return NextResponse.json(
      { error: "Fant ikke lagerlinje" },
      { status: 404 }
    );
  }

  const previousQuantity = inventory.quantity ?? 0;

  const { error: updateError } = await supabaseAdmin
    .from("inventory")
    .update({ quantity })
    .eq("id", inventoryId);

  if (updateError) {
    return NextResponse.json(
      { error: "Kunne ikke oppdatere antall" },
      { status: 500 }
    );
  }

  const product =
    Array.isArray(inventory.products)
      ? inventory.products[0]
      : inventory.products;

  const location =
    Array.isArray(inventory.locations)
      ? inventory.locations[0]
      : inventory.locations;

  await supabaseAdmin.from("activity_log").insert({
    entity_type: "inventory",
    entity_id: inventoryId,
    action: "quantity_updated",
    title: "Antall oppdatert",
    description: `${product?.product_name ?? "Ukjent produkt"} på ${
      location?.code ?? "ukjent lokasjon"
    }: ${previousQuantity} → ${quantity}`,
    actor_name: profile.display_name ?? user.email ?? null,
actor_email: user.email ?? null,
    metadata: {
      product_id: inventory.product_id,
      inventory_id: inventoryId,
      location_id: inventory.location_id,
      location_code: location?.code ?? null,
      previous_quantity: previousQuantity,
      new_quantity: quantity,
      source: "location_page",
      user_id: user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    inventoryId,
    previousQuantity,
    newQuantity: quantity,
  });
}