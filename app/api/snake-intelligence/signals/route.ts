import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { tryGetSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SignalLevel = "medium" | "high" | "critical";

type OperationalSignal = {
  type: "needs-check" | "location-diff";
  level: SignalLevel;
  title: string;
  description: string;
  href: string;
  count: number;
};

export async function GET() {
  const auth = await requireRole(["admin", "user", "warehouse", "lager"]);

  if (!auth.ok) return auth.response;

  const supabaseAdmin = tryGetSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  const [skipsResult, countDiffsResult] = await Promise.all([
    supabaseAdmin
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "fix_location_skipped"),

    supabaseAdmin
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "location_count_completed")
      .eq("metadata->>status", "diff"),
  ]);

  if (skipsResult.error || countDiffsResult.error) {
    console.error("Snake Intelligence signals feilet", {
      skipsError: skipsResult.error,
      countDiffsError: countDiffsResult.error,
    });

    return NextResponse.json(
      { error: "Kunne ikke hente signaler" },
      { status: 500 }
    );
  }

  const skippedCount = skipsResult.count ?? 0;
  const locationDiffCount = countDiffsResult.count ?? 0;

  const signals: OperationalSignal[] = [];

  if (skippedCount > 0) {
    signals.push({
      type: "needs-check",
      level: skippedCount >= 5 ? "high" : "medium",
      title: "Produkter bør sjekkes",
      description: `${skippedCount} produkter er hoppet over i ryddemodus.`,
      href: "/activity",
      count: skippedCount,
    });
  }

  if (locationDiffCount > 0) {
    signals.push({
      type: "location-diff",
      level: locationDiffCount >= 3 ? "high" : "medium",
      title: "Lokasjoner med telleavvik",
      description: `${locationDiffCount} lokasjoner er telt med avvik.`,
      href: "/activity",
      count: locationDiffCount,
    });
  }

  return NextResponse.json({ signals });
}
