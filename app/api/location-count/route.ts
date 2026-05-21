import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

type Body = {
  locationId: string;
  inventoryId: string;
  expectedQuantity: number;
  countedQuantity: number;
  note?: string | null;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) return null;

  return createSupabaseAdminClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager", "viewer"]);

  if (!auth.ok) return auth.response;

  const { user, profile } = auth;

  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const locationId = String(body.locationId ?? "").trim();
  const inventoryId = String(body.inventoryId ?? "").trim();
  const expectedQuantity = Number(body.expectedQuantity);
  const countedQuantity = Number(body.countedQuantity);
  const note = String(body.note ?? "").trim();

  if (!locationId) {
    return NextResponse.json({ error: "Mangler lokasjon" }, { status: 400 });
  }

  if (!inventoryId) {
    return NextResponse.json({ error: "Mangler lagerlinje" }, { status: 400 });
  }

  if (
    Number.isNaN(expectedQuantity) ||
    Number.isNaN(countedQuantity) ||
    expectedQuantity < 0 ||
    countedQuantity < 0
  ) {
    return NextResponse.json({ error: "Ugyldig antall" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("location_counts")
    .insert({
      location_id: locationId,
      inventory_id: inventoryId,
      expected_quantity: expectedQuantity,
      counted_quantity: countedQuantity,
      note: note || null,
      counted_by: user.id,
      counted_by_name: profile.display_name ?? user.email ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Location count insert feilet", error);

    return NextResponse.json(
      { error: "Kunne ikke lagre telling" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, count: data });
}