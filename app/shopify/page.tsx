import { redirect } from "next/navigation";
import { RoyCatalogWorkspace } from "./RoyCatalogWorkspace";
import { createClient } from "@/lib/supabase/server";
import { RoyWorkReport } from './RoyWorkReport';
import { royPhase2bEnabled } from '@/lib/intelligence/roy/phase2b-gate';
import { parseReview, type ReviewReport } from '@/lib/intelligence/roy/review';

export const dynamic = "force-dynamic";

export default async function ShopifyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile?.active || !["admin", "user"].includes(profile.role)) redirect("/dashboard");

  const reviewEnabled=royPhase2bEnabled();
  let report: ReviewReport|null=null;
  let reportError=false;
  if (reviewEnabled) {
    try {
      const {data,error}=await supabase.rpc('get_roy_review_v1');
      if (error) throw error;
      report=parseReview(data);
    } catch { reportError=true; }
  }
  return (
    <main className="mx-auto max-w-7xl">
      {reviewEnabled?<RoyWorkReport initial={report} loadError={reportError} canRun={profile.role==='admin'}><RoyCatalogWorkspace /></RoyWorkReport>:<header className="mb-6 text-snake-text-on-dark"><h1 className="text-3xl font-semibold">Roy</h1><p className="mt-1">Produktansvarlig</p><p className="mt-2 text-sm">Katalogkontroll er ikke aktivert.</p></header>}
      {!reviewEnabled?<RoyCatalogWorkspace />:null}
    </main>
  );
}
