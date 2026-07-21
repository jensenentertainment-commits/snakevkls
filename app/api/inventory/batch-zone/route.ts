import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = { productIds: string[]; zoneId: string };

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager"]);
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  const body = (await request.json()) as Body;
  const productIds = body.productIds ?? [];
  const zoneId = String(body.zoneId ?? "").trim();

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json({ error: "Ingen produkter valgt" }, { status: 400 });
  }
  if (!zoneId) {
    return NextResponse.json({ error: "Mangler sone" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("batch_set_product_zone", {
    requested_product_ids: productIds,
    requested_zone_id: zoneId,
    requested_actor_id: user.id,
    requested_actor_email: user.email ?? null,
    requested_actor_name: profile.display_name ?? user.email ?? null,
  });

  if (error) {
    console.error("Atomic batch placement feilet", error);
    return NextResponse.json(
      { error: "Kunne ikke oppdatere produkter" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
