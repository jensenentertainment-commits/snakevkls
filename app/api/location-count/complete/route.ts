import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";
import { logActivity } from "@/lib/log-activity";

export const dynamic = "force-dynamic";

type Body = {
  locationId: string;
  locationCode: string;
  totalLines: number;
  matchedLines: number;
  diffLines: number;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) return null;

  return createSupabaseAdminClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager", "viewer"]);

  if (!auth.ok) return auth.response;

  const { user, profile } = auth;

  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const locationId = String(body.locationId ?? "").trim();
  const locationCode = String(body.locationCode ?? "").trim();

  const totalLines = Number(body.totalLines);
  const matchedLines = Number(body.matchedLines);
  const diffLines = Number(body.diffLines);

  if (!locationId) {
    return NextResponse.json({ error: "Mangler lokasjon" }, { status: 400 });
  }

  if (
    Number.isNaN(totalLines) ||
    Number.isNaN(matchedLines) ||
    Number.isNaN(diffLines)
  ) {
    return NextResponse.json({ error: "Ugyldig telling" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  await logActivity(supabaseAdmin, {
    entityType: "location",
    entityId: locationId,
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
    actorId: user.id,
    actorEmail: user.email ?? null,
    actorName: profile.display_name ?? user.email ?? null,
  });

  return NextResponse.json({ ok: true });
}