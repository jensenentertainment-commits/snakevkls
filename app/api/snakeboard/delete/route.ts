import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

type Body = {
  id: string;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) return null;

  return createSupabaseAdminClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) return auth.response;

  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();

  if (!id) {
    return NextResponse.json({ error: "Mangler melding" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from("snakeboard_messages")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("SnakeBoard delete feilet", error);

    return NextResponse.json(
      { error: "Kunne ikke slette melding" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}