import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  locationId: string;
  locationCode: string;
  totalLines: number;
  matchedLines: number;
  diffLines: number;
};

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager"]);
  if (!auth.ok) return auth.response;

  const { user, profile } = auth;
  const supabaseAdmin = getSupabaseAdmin();
  const body = (await request.json()) as Body;
  const locationId = String(body.locationId ?? "").trim();
  const locationCode = String(body.locationCode ?? "").trim();
  const totalLines = Number(body.totalLines);
  const matchedLines = Number(body.matchedLines);
  const diffLines = Number(body.diffLines);

  if (!locationId) {
    return NextResponse.json({ error: "Mangler lokasjon" }, { status: 400 });
  }
  if (![totalLines, matchedLines, diffLines].every(Number.isInteger)) {
    return NextResponse.json({ error: "Ugyldig telling" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("activity_log").insert({
    entity_type: "location",
    entity_id: locationId,
    action: "location_count_completed",
    title: "Lokasjonstelling fullført",
    description:
      diffLines > 0
        ? `${locationCode || "Lokasjon"} telt med ${diffLines} avvik.`
        : `${locationCode || "Lokasjon"} telt uten avvik.`,
    metadata: {
      locationId,
      locationCode,
      totalLines,
      matchedLines,
      diffLines,
      status: diffLines > 0 ? "diff" : "clean",
    },
    actor_id: user.id,
    actor_email: user.email ?? null,
    actor_name: profile.display_name ?? user.email ?? null,
  });

  if (error) {
    console.error("Location count completion log feilet", error);
    return NextResponse.json(
      { error: "Kunne ikke logge fullført telling" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
