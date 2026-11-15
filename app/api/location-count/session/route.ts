import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { handleCountCommand } from "@/lib/inventory/count-handler";
import { isCountId } from "@/lib/inventory/count-session";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) { return handleCountCommand(request, "session"); }
export async function GET(request: NextRequest) {
  const auth = await requireRole(["admin", "user", "warehouse"]);
  if (!auth.ok) return auth.response;
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!isCountId(locationId)) return NextResponse.json({ error: "Ugyldig lokasjon" }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().rpc("get_location_count_session_v1", { requested_location_id: locationId });
  if (error) return NextResponse.json({ error: "Kunne ikke hente lagret telling." }, { status: 500 });
  return NextResponse.json({ session: data }, { headers: { "Cache-Control": "no-store" } });
}
