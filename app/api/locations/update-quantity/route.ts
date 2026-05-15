import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  inventoryId: string;
  quantity: number;
};

export async function POST(request: NextRequest) {
  const authClient = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Mangler admin-tilgang" },
      { status: 403 }
    );
  }

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