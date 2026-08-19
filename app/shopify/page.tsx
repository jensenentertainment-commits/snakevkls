import { redirect } from "next/navigation";
import { RoyCatalogWorkspace } from "./RoyCatalogWorkspace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ShopifyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile?.active || !["admin", "user"].includes(profile.role)) redirect("/dashboard");

  return (
    <main>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[var(--snake-text-eyebrow-tracking)] text-snake-brand-strong">Shopify · Roy</p>
        <h1 className="mt-2 text-[length:var(--snake-text-display-page-mobile-size)] font-semibold leading-[var(--snake-text-display-page-mobile-line-height)] text-snake-text-primary sm:text-[length:var(--snake-text-display-page-size)] sm:leading-[var(--snake-text-display-page-line-height)]">Produktverksted</h1>
        <p className="mt-3 max-w-3xl text-snake-text-secondary">Les katalogen, finn kvalitetsproblemer og få konkrete produktfaglige anbefalinger for Varekompaniet.</p>
      </header>
      <RoyCatalogWorkspace />
    </main>
  );
}
