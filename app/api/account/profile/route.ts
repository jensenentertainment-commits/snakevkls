import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { logActivity } from "@/lib/log-activity";
import { tryGetSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  displayName: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "user", "warehouse"]);

  if (!auth.ok) return auth.response;

  const { user, profile } = auth;

  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const displayName = String(body.displayName ?? "").trim();

  if (!displayName) {
    return NextResponse.json({ error: "Mangler visningsnavn" }, { status: 400 });
  }

  if (displayName.length > 60) {
    return NextResponse.json(
      { error: "Visningsnavn kan maks være 60 tegn" },
      { status: 400 }
    );
  }

  const supabaseAdmin = tryGetSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) {
    console.error("Profile update feilet", error);

    return NextResponse.json(
      { error: "Kunne ikke oppdatere profil" },
      { status: 500 }
    );
  }

  await logActivity(supabaseAdmin, {
    entityType: "user",
    entityId: user.id,
    action: "profile_updated",
    title: "Profil oppdatert",
    description: `${profile.display_name ?? user.email ?? "Bruker"} endret visningsnavn.`,
    metadata: {
      previousDisplayName: profile.display_name,
      newDisplayName: displayName,
    },
    actorId: user.id,
    actorEmail: user.email ?? null,
    actorName: displayName,
  });

  return NextResponse.json({ ok: true, displayName });
}
