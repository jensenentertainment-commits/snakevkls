import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  inventoryId: string;
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

  if (!inventoryId) {
    return NextResponse.json({ error: "Mangler lagerlinje" }, { status: 400 });
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

  const product = Array.isArray(inventory.products)
    ? inventory.products[0]
    : inventory.products;

  const location = Array.isArray(inventory.locations)
    ? inventory.locations[0]
    : inventory.locations;

  const { error: deleteError } = await supabaseAdmin
    .from("inventory")
    .delete()
    .eq("id", inventoryId);

  if (deleteError) {
    return NextResponse.json(
      { error: "Kunne ikke fjerne produkt fra lokasjon" },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("activity_log").insert({
    entity_type: "inventory",
    entity_id: inventoryId,
    action: "removed_from_location",
    title: "Produkt fjernet fra lokasjon",
    description: `${product?.product_name ?? "Ukjent produkt"} fjernet fra ${
      location?.code ?? "ukjent lokasjon"
    }`,
    actor_email: user.email ?? null,
    metadata: {
      product_id: inventory.product_id,
      inventory_id: inventoryId,
      location_id: inventory.location_id,
      location_code: location?.code ?? null,

      from_location: location?.code ?? null,
      to_location: null,

      previous_quantity: inventory.quantity ?? 0,
      new_quantity: 0,

      removed_quantity: inventory.quantity ?? 0,
      source: "location_page",
      user_id: user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    inventoryId,
  });
}