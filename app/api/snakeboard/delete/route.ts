import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { tryGetSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  id: string;
};

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

  const supabaseAdmin = tryGetSupabaseAdmin();

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
