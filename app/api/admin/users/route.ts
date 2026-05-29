import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createSupabaseAdminClient(
    supabaseUrl,
    supabaseServiceKey
  );
}

export async function GET() {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const supabaseAdmin = getSupabaseAdmin();

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