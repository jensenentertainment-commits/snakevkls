import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parsePlacement } from "@/lib/inventory/placement";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "user", "warehouse"]);
  if (!auth.ok) return auth.response;
  let args;
  try { args = parsePlacement(await request.json()); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ugyldig forespørsel" }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin().rpc("save_product_placement_v2", {
    ...args, requested_actor_id: auth.user.id, requested_actor_email: auth.user.email ?? null,
    requested_actor_name: auth.profile.display_name ?? auth.user.email ?? null,
  });
  if (error) {
    const conflict = ["40001", "23505", "40P01", "55P03"].includes(error.code);
    return NextResponse.json({ error: conflict
      ? "Lagerposten eller målplasseringen er endret. Last siden på nytt og kontroller før du prøver igjen."
      : error.code === "22023" ? "Kontroller lagerposten og velg en aktiv lokasjon med sone."
      : "Kunne ikke lagre plassering" }, { status: conflict ? 409 : error.code === "22023" ? 400 : 500 });
  }
  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
