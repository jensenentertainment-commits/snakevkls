import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  locationId: string;
  locationCode: string;
  sku: string;
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

  const allowedRoles = ["admin", "lager"];

if (profileError || !profile?.role || !allowedRoles.includes(profile.role)) {
  return NextResponse.json(
    { error: "Mangler tilgang" },
    { status: 403 }
  );
}

  const body = (await request.json()) as Body;

  const locationId = body.locationId;
  const locationCode = body.locationCode;
  const sku = body.sku?.trim();
  const quantity = Number(body.quantity);

  if (!locationId || !locationCode) {
    return NextResponse.json({ error: "Mangler lokasjon" }, { status: 400 });
  }

  if (!sku) {
    return NextResponse.json({ error: "Skriv inn SKU" }, { status: 400 });
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

  const { data: location, error: locationError } = await supabaseAdmin
    .from("locations")
    .select("id, code, zone_id")
    .eq("id", locationId)
    .single();

  if (locationError || !location) {
    return NextResponse.json({ error: "Fant ikke lokasjon" }, { status: 404 });
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, sku, product_name")
    .ilike("sku", sku)
    .maybeSingle();

  if (productError) {
    return NextResponse.json(
      { error: "Kunne ikke finne produkt" },
      { status: 500 }
    );
  }

  if (!product) {
    return NextResponse.json(
      { error: `Fant ingen produkt med SKU: ${sku}` },
      { status: 404 }
    );
  }

  const { data: existingInventory, error: existingError } = await supabaseAdmin
    .from("inventory")
    .select("id, quantity")
    .eq("product_id", product.id)
    .eq("location_id", location.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: "Kunne ikke sjekke eksisterende lagerlinje" },
      { status: 500 }
    );
  }

  let savedInventoryId: string | null = existingInventory?.id ?? null;
  const previousQuantity = existingInventory?.quantity ?? 0;
  const newQuantity = previousQuantity + quantity;

  if (existingInventory) {
    const { error } = await supabaseAdmin
      .from("inventory")
      .update({
        quantity: newQuantity,
        zone_id: location.zone_id,
      })
      .eq("id", existingInventory.id);

    if (error) {
      return NextResponse.json(
        { error: "Kunne ikke oppdatere lagerlinje" },
        { status: 500 }
      );
    }
  } else {
    const { data, error } = await supabaseAdmin
      .from("inventory")
      .insert({
        product_id: product.id,
        location_id: location.id,
        zone_id: location.zone_id,
        quantity,
        is_primary: false,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return NextResponse.json(
        { error: "Kunne ikke legge til produkt" },
        { status: 500 }
      );
    }

    savedInventoryId = data.id;
  }

  await supabaseAdmin.from("activity_log").insert({
    entity_type: "location",
    entity_id: location.id,
    action: "product_added_to_location",
    title: "Produkt lagt til lokasjon",
    description: `${product.product_name} → ${location.code}`,
    actor_email: user.email ?? null,
    metadata: {
      product_id: product.id,
      inventory_id: savedInventoryId,
      location_id: location.id,
      location_code: location.code,
      previous_quantity: previousQuantity,
      new_quantity: existingInventory ? newQuantity : quantity,
      added_quantity: quantity,
      source: "location_page",
      user_id: user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    productId: product.id,
    inventoryId: savedInventoryId,
    previousQuantity,
    newQuantity: existingInventory ? newQuantity : quantity,
  });
}