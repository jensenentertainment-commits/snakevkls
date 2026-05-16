import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  userId: string;
  displayName?: string | null;
  role?: "admin" | "lager" | "viewer";
  active?: boolean;
};

export async function POST(request: NextRequest) {
  const authClient = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Mangler admin-tilgang" },
      { status: 403 }
    );
  }

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