import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { logActivity } from "@/lib/log-activity";
import { tryGetSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SkipReason =
  | "not_found"
  | "wrong_zone"
  | "needs_check"
  | "no_location"
  | "other";

type Body = {
  productId: string;
  inventoryId: string;
  reason: SkipReason;
  note?: string | null;
};

const validReasons: SkipReason[] = [
  "not_found",
  "wrong_zone",
  "needs_check",
  "no_location",
  "other",
];

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager"]);

  if (!auth.ok) return auth.response;

  const { user, profile } = auth;

  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const productId = String(body.productId ?? "").trim();
  const inventoryId = String(body.inventoryId ?? "").trim();
  const reason = body.reason;
  const note = String(body.note ?? "").trim();

  if (!productId) {
    return NextResponse.json({ error: "Mangler produkt" }, { status: 400 });
  }

  if (!inventoryId) {
    return NextResponse.json({ error: "Mangler lagerlinje" }, { status: 400 });
  }

  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: "Ugyldig årsak" }, { status: 400 });
  }

  if (note.length > 500) {
    return NextResponse.json(
      { error: "Notat kan maks være 500 tegn" },
      { status: 400 }
    );
  }

  const supabaseAdmin = tryGetSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  await logActivity(supabaseAdmin, {
    entityType: "inventory",
    entityId: inventoryId,
    action: "fix_location_skipped",
    title: "Ryddemodus hoppet over",
    description: getReasonLabel(reason),
    metadata: {
      productId,
      inventoryId,
      reason,
      note: note || null,
    },
    actorId: user.id,
    actorEmail: user.email ?? null,
    actorName: profile.display_name ?? user.email ?? null,
  });

  return NextResponse.json({ ok: true });
}

function getReasonLabel(reason: SkipReason) {
  switch (reason) {
    case "not_found":
      return "Produktet ble ikke funnet fysisk.";
    case "wrong_zone":
      return "Produktet ser ut til å ligge i feil sone.";
    case "needs_check":
      return "Produktet må sjekkes nærmere.";
    case "no_location":
      return "Fant ikke egnet lokasjon.";
    case "other":
      return "Hoppet over av annen årsak.";
  }
}
