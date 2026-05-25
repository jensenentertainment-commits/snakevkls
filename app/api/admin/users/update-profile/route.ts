import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

type Body = {
  userId: string;
  displayName?: string | null;
  role?: "admin" | "lager" | "viewer";
  active?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin"]);

if (!auth.ok) return auth.response;

  const body = (await request.json()) as Body;

  if (!body.userId) {
    return NextResponse.json({ error: "Mangler bruker" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.displayName !== "undefined") {
    updates.display_name = body.displayName?.trim() || null;
  }

  if (typeof body.role !== "undefined") {
    const validRoles = ["admin", "lager", "viewer"];

    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: "Ugyldig rolle" }, { status: 400 });
    }

    updates.role = body.role;
  }

  if (typeof body.active !== "undefined") {
    updates.active = body.active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Ingen endringer sendt" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  const supabaseAdmin = createSupabaseAdminClient(
    supabaseUrl,
    supabaseServiceKey
  );

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", body.userId);

  if (error) {
    return NextResponse.json(
      { error: "Kunne ikke oppdatere bruker" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}