import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  productId: string;
  quantity: number;
  reason: string;
  note?: string | null;
};

export async function POST(request: NextRequest) {
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

  const productId = body.productId;
  const quantity = Number(body.quantity);
  const reason = body.reason;
  const note = body.note?.trim() || null;

  if (!productId) {
    return NextResponse.json(
      { error: "Mangler produkt" },
      { status: 400 }
    );
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    return NextResponse.json(
      { error: "Ugyldig antall" },
      { status: 400 }
    );
  }

  const validReasons = [
    "manual_sale",
    "waste",
    "internal_use",
    "correction",
    "other",
  ];

  if (!validReasons.includes(reason)) {
    return NextResponse.json(
      { error: "Ugyldig årsak" },
      { status: 400 }
    );
  }

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

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select(`
      id,
      product_name,
      inventory (
        id,
        quantity
      )
    `)
    .eq("id", productId)
    .single();

  if (productError || !product) {
    return NextResponse.json(
      { error: "Fant ikke produkt" },
      { status: 404 }
    );
  }

  const existing = product.inventory?.[0];

  if (!existing) {
    return NextResponse.json(
      { error: "Produktet har ingen lagerlinje" },
      { status: 400 }
    );
  }

  const currentQuantity = existing.quantity ?? 0;

  const actualQuantity = Math.min(quantity, currentQuantity);

  if (actualQuantity <= 0) {
    return NextResponse.json(
      { error: "Ingen lagerbeholdning å trekke fra" },
      { status: 400 }
    );
  }

  const quantityDelta = -actualQuantity;
  const nextQuantity = currentQuantity + quantityDelta;

  const { error: inventoryError } = await supabaseAdmin
    .from("inventory")
    .update({
      quantity: nextQuantity,
    })
    .eq("id", existing.id);

  if (inventoryError) {
    console.error("Inventory update feilet", inventoryError);

    return NextResponse.json(
      { error: "Kunne ikke oppdatere lager" },
      { status: 500 }
    );
  }

  const { error: movementError } = await supabaseAdmin
    .from("stock_movements")
    .insert({
      product_id: productId,
      inventory_id: existing.id,
      quantity_delta: quantityDelta,
      reason,
      note,
    });

  if (movementError) {
    console.error("Stock movement insert feilet", movementError);

    return NextResponse.json(
      { error: "Kunne ikke logge lagerhendelse" },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("activity_log")
    .insert({
      entity_type: "stock_movement",
      entity_id: existing.id,
      action: "manual_stock_movement",
      title: "Lagerhendelse registrert",
      description: `${product.product_name} (${quantityDelta})`,
      actor_email: user.email ?? null,
      metadata: {
        product_id: productId,
        inventory_id: existing.id,
        quantity_delta: quantityDelta,
        reason,
        note,
        user_id: user.id,
      },
    });

  return NextResponse.json({
    ok: true,
    quantityDelta,
    nextQuantity,
  });
}