import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { tryGetSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const supabaseAdmin = tryGetSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Mangler env vars" },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(`
      id,
      email,
      display_name,
      role,
      active,
      created_at
    `)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Kunne ikke hente brukere" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    users: data ?? [],
  });
}
