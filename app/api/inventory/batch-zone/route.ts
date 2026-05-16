
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  productIds: string[];
  zoneId: string;
};

export async function POST(request: NextRequest) {
  // AUTH
  const authClient = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Ikke innlogget" },
      { status: 401 }
    );
  }

  // ADMIN CHECK
  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["admin", "lager"];

if (profileError || !profile?.role || !allowedRoles.includes(profile.role)) {
  return NextResponse.json(
    { error: "Mangler tilgang" },
    { status: 403 }
  );
}

  // BODY
  const body = (await request.json()) as Body;

  const productIds = body.productIds ?? [];
  const zoneId = body.zoneId;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json(
      { error: "Ingen produkter valgt" },
      { status: 400 }
    );
  }

  if (!zoneId) {
    return NextResponse.json(
      { error: "Mangler sone" },
      { status: 400 }
    );
  }

  // SERVICE ROLE CLIENT
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Mangler env vars" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createSupabaseAdminClient(
    supabaseUrl,
    supabaseServiceKey
  );

  // FETCH PRODUCTS
  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select(`
      id,
      shopify_quantity,
      inventory (
        id,
        quantity
      )
    `)
    .in("id", productIds);

  if (productsError) {
    console.error("Kunne ikke hente produkter", productsError);

    return NextResponse.json(
      { error: "Kunne ikke hente produkter" },
      { status: 500 }
    );
  }

  let updated = 0;

  for (const product of products ?? []) {
    const existing = product.inventory?.[0];

    const quantity =
      existing?.quantity ??
      product.shopify_quantity ??
      0;

    const payload = {
      zone_id: zoneId,
      quantity,
    };

    const { error } = existing
      ? await supabaseAdmin
          .from("inventory")
          .update(payload)
          .eq("id", existing.id)
      : await supabaseAdmin
          .from("inventory")
          .insert({
            product_id: product.id,
            ...payload,
            is_primary: true,
          });

    if (error) {
      console.error("Batch zone update feilet", error);

      return NextResponse.json(
        { error: "Kunne ikke oppdatere produkter" },
        { status: 500 }
      );
    }

    updated++;
  }

  // LOG
  await supabaseAdmin
    .from("activity_log")
    .insert({
      entity_type: "inventory",
      entity_id: null,
      action: "batch_zone_set",
      title: "Batch sone satt",
      description: `${updated} produkter oppdatert`,
      actor_email: user.email ?? null,
      metadata: {
        zone_id: zoneId,
        product_ids: productIds,
        updated,
        user_id: user.id,
      },
    });

  return NextResponse.json({
    ok: true,
    updated,
  });
}
