import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  productId: string;
  inventoryId?: string | null;
  zoneId?: string | null;
  locationId?: string | null;
  quantity: number;
};

type RelationCode = {
  code: string | null;
};

function getRelationCode(value: RelationCode | RelationCode[] | null | undefined) {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value[0]?.code ?? null;
  }

  return value.code ?? null;
}

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

  const productId = body.productId;
  const inventoryId = body.inventoryId ?? null;
  const locationId = body.locationId || null;
  const quantity = Number(body.quantity);

  if (!productId) {
    return NextResponse.json({ error: "Mangler produkt" }, { status: 400 });
  }

  if (Number.isNaN(quantity) || quantity < 0) {
    return NextResponse.json({ error: "Ugyldig antall" }, { status: 400 });
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

  let previousZoneCode: string | null = null;
let previousLocationCode: string | null = null;
let previousQuantity = 0;

if (inventoryId) {
  const { data: existingInventory } = await supabaseAdmin
    .from("inventory")
    .select(`
      id,
      quantity,
      zones (
        code
      ),
      locations (
        code
      )
    `)
    .eq("id", inventoryId)
    .single();

 previousZoneCode = getRelationCode(
  existingInventory?.zones as RelationCode | RelationCode[] | null | undefined
);

previousLocationCode = getRelationCode(
  existingInventory?.locations as RelationCode | RelationCode[] | null | undefined
);
}
  let zoneId = body.zoneId || null;
  let locationCode: string | null = null;
  let zoneCode: string | null = null;

  if (locationId) {
    const { data: location, error: locationError } = await supabaseAdmin
      .from("locations")
      .select("id, code, zone_id")
      .eq("id", locationId)
      .single();

    if (locationError || !location) {
      return NextResponse.json(
        { error: "Ugyldig lokasjon" },
        { status: 400 }
      );
    }

    zoneId = location.zone_id ?? zoneId;
    locationCode = location.code;
  }

  if (zoneId) {
  const { data: zone } = await supabaseAdmin
    .from("zones")
    .select("code")
    .eq("id", zoneId)
    .single();

  zoneCode = zone?.code ?? null;
}

  if (!zoneId && !locationId) {
    return NextResponse.json(
      { error: "Velg minst sone eller lokasjon" },
      { status: 400 }
    );
  }

  const payload = {
    location_id: locationId,
    zone_id: zoneId,
    quantity,
  };

  let savedInventoryId = inventoryId;

  if (inventoryId) {
    const { error } = await supabaseAdmin
      .from("inventory")
      .update(payload)
      .eq("id", inventoryId);

    if (error) {
      console.error("Inventory update feilet", error);

      return NextResponse.json(
        { error: "Kunne ikke oppdatere plassering" },
        { status: 500 }
      );
    }
  } else {
    const { data, error } = await supabaseAdmin
      .from("inventory")
      .insert({
        product_id: productId,
        ...payload,
        is_primary: true,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("Inventory insert feilet", error);

      return NextResponse.json(
        { error: "Kunne ikke opprette plassering" },
        { status: 500 }
      );
    }

    savedInventoryId = data.id;
  }

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("product_name")
    .eq("id", productId)
    .single();

  await supabaseAdmin.from("activity_log").insert({
    entity_type: "inventory",
    entity_id: savedInventoryId,
    action: locationId ? "location_set" : "zone_set",
    title: locationId ? "Lokasjon satt" : "Sone satt",
    description: locationId
      ? `${product?.product_name ?? "Produkt"} → ${
          locationCode ?? "ukjent lokasjon"
        }`
      : `${product?.product_name ?? "Produkt"} → sone`,
      actor_email: user.email ?? null,
    metadata: {
  product_id: productId,
  inventory_id: savedInventoryId,

  from_zone: previousZoneCode,
  to_zone: zoneCode,

  from_location: previousLocationCode,
  to_location: locationCode,

  previous_quantity: previousQuantity,
  new_quantity: quantity,

  location_id: locationId,
  location_code: locationCode,
  zone_id: zoneId,
  zone_code: zoneCode,

  source: "manual",
  user_id: user.id,
},
  });

  return NextResponse.json({
    ok: true,
    inventoryId: savedInventoryId,
  });
}