import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { tryGetSupabaseAdmin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";

type Body = {
  email: string;
  password: string;
  displayName: string;
  role: "admin" | "lager";
  active?: boolean;
};

export async function POST(request: NextRequest) {
const auth = await requireRole(["admin"]);

if (!auth.ok) return auth.response;



  const body = (await request.json()) as Body;

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const displayName = body.displayName?.trim();
  const role = body.role;
  const active = body.active ?? true;

  if (!email) {
    return NextResponse.json({ error: "Mangler epost" }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Passord må være minst 8 tegn" },
      { status: 400 }
    );
  }

  if (!displayName) {
    return NextResponse.json(
      { error: "Mangler visningsnavn" },
      { status: 400 }
    );
  }

  if (!["admin", "lager"].includes(role)) {
    return NextResponse.json({ error: "Ugyldig rolle" }, { status: 400 });
  }

  const supabaseAdmin = tryGetSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Kunne ikke opprette bruker" },
      { status: 500 }
    );
  }

  const { error: profileInsertError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: created.user.id,
      email,
      display_name: displayName,
      role,
      active,
    });

  if (profileInsertError) {
    return NextResponse.json(
      { error: "Bruker opprettet, men profil kunne ikke lagres" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    userId: created.user.id,
  });
}
