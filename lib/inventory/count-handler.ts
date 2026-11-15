import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { countCommand, countError } from "./count-session";
export async function handleCountCommand(request: NextRequest, mode: "session" | "save" | "complete") {
  const auth = await requireRole(["admin", "user", "warehouse"]);
  if (!auth.ok) return auth.response;
  let command;
  try { command = countCommand(await request.json(), mode); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ugyldig forespørsel" }, { status: 400 }); }
  const { data, error } = await getSupabaseAdmin().rpc("manage_location_count_v1", {
    ...command, requested_actor_id: auth.user.id, requested_actor_email: auth.user.email ?? null,
    requested_actor_name: auth.profile.display_name ?? auth.user.email ?? null,
  });
  if (error) {
    const failure = countError(error.code);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true, session: data }, { headers: { "Cache-Control": "no-store" } });
}
