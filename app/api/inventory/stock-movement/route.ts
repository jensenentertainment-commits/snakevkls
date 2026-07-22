import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  productId: string;
  quantity: number;
  reason: string;
  note?: string | null;
};

const validReasons = [
  "manual_sale",
  "waste",
  "internal_use",
  "correction",
  "other",
];

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager"]);
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  const supabaseAdmin = getSupabaseAdmin();
  const body = (await request.json()) as Body;
  const productId = String(body.productId ?? "").trim();
  const quantity = Number(body.quantity);
  const reason = String(body.reason ?? "");
  const note = body.note?.trim() || null;

  if (!productId) {
    return NextResponse.json({ error: "Mangler produkt" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Ugyldig antall" }, { status: 400 });
  }
  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: "Ugyldig årsak" }, { status: 400 });
  }

  const { data: inventory, error: inventoryError } = await supabaseAdmin
    .from("inventory")
    .select("id")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (inventoryError || !inventory) {
    return NextResponse.json(
      { error: "Produktet har ingen lagerlinje" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.rpc("apply_stock_movement", {
    requested_inventory_id: inventory.id,
    requested_quantity_delta: -quantity,
    requested_reason: reason,
    requested_note: note,
    expected_quantity: null,
    requested_actor_id: user.id,
    requested_actor_email: user.email ?? null,
    requested_actor_name: profile.display_name ?? user.email ?? null,
  });

  if (error) {
    console.error("Atomic stock movement feilet", error);
    const insufficient = error.message.includes("Insufficient inventory");
    return NextResponse.json(
      {
        error: insufficient
          ? "Ikke nok lagerbeholdning"
          : "Kunne ikke registrere lagerhendelse",
      },
      { status: insufficient ? 400 : 500 }
    );
  }

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
