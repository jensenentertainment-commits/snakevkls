import { redirect } from "next/navigation";
import { AuthenticatedAppShell } from "@/app/components/shell/AuthenticatedAppShell";
import { Surface } from "@/app/components/design-system/Surface";
import { requireRole } from "@/lib/auth/require-role";
import { readConversationData } from "@/lib/intelligence/borre/conversation-data";
import { buildWorkspaceOverview } from "@/lib/intelligence/borre/workspace-overview";
import { formatRoyTime } from "@/lib/intelligence/roy/format-time";
import { BorreWorkspace } from "./BorreWorkspace";

export const dynamic = "force-dynamic";

export default async function BorrePage() {
  const auth = await requireRole(["admin", "user", "warehouse"]);
  if (!auth.ok) redirect(auth.response.status === 401 ? "/login" : "/dashboard");
  let overview: ReturnType<typeof buildWorkspaceOverview> | null = null;
  let readAt: string | null = null;
  try {
    const data = await readConversationData({ kind: "summary" }, async (table, columns, from, to, filter) => {
      let query = auth.authClient.from(table).select(columns, { count: "exact" }).order("id");
      if (filter?.op === "in") query = query.in(filter.column, filter.value as string[]);
      else if (filter?.op === "ilike") query = query.ilike(filter.column, filter.value as string);
      else if (filter) query = query.eq(filter.column, filter.value as string);
      return await query.range(from, to);
    });
    overview = buildWorkspaceOverview(data);
    readAt = new Date().toISOString();
  } catch { /* Unknown is explicit; never substitute old dashboard counts. */ }
  return <AuthenticatedAppShell width="wide"><main className="mx-auto max-w-7xl">
    <Surface as="section" variant="dark" className="overflow-hidden">
      <header className="bg-snake-hero px-5 py-5 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-snake-text-on-dark">Børre</h1>
        <p className="mt-1 text-lg text-snake-text-on-dark-muted">Lageransvarlig</p>
      </header>
      <div className="border-t border-snake-border-on-dark-subtle bg-snake-app-elevated px-5 py-3 text-sm text-snake-text-on-dark-muted">{readAt ? `Lagerdata lest ${formatRoyTime(readAt)} · Kun lesing` : "Lageroversikten er utilgjengelig · Du kan fortsatt prøve samtalen"}</div>
      <div className="grid items-start lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <BorreWorkspace />
        <aside aria-labelledby="borre-overview-title" className="min-w-0 self-stretch border-t border-snake-border-on-dark-default bg-snake-app-deep p-5 text-snake-text-on-dark sm:p-6 lg:border-l lg:border-t-0">
          <h2 id="borre-overview-title" className="text-xl font-semibold text-snake-brand">Lageroversikt</h2>
          <p className="mt-2 text-sm leading-6 text-snake-text-on-dark-muted">Fysisk lagerregistrering er ufullstendig eller ukjent. Tallene viser registreringer, ikke en bekreftet opptelling.</p>
          <div className="mt-5 space-y-3">
            <section className="rounded-snake-card border border-snake-border-on-dark-default bg-snake-app-elevated p-4"><h3 className="text-sm font-semibold">Registrert Snake-beholdning</h3><p className="mt-2 text-2xl font-semibold">{overview?.registeredQuantity == null ? "Ukjent" : `${overview.registeredQuantity.toLocaleString("nb-NO")} enheter`}</p><p className="mt-2 text-sm leading-6 text-snake-text-on-dark-muted">Summert over alle tilgjengelige lagerposter, også varer på flere lokasjoner.</p></section>
            <section className="rounded-snake-card border border-snake-border-on-dark-default bg-snake-app-elevated p-4"><h3 className="text-sm font-semibold">Positiv beholdning uten gyldig lokasjon</h3><p className="mt-2 text-2xl font-semibold">{overview?.invalidPlacementRows == null ? "Ukjent" : `${overview.invalidPlacementRows} ${overview.invalidPlacementRows === 1 ? "lagerpost" : "lagerposter"}`}</p><p className="mt-2 text-sm leading-6 text-snake-text-on-dark-muted">{overview?.invalidPlacementRows === 0 ? "Ingen slike plasseringer i de leste dataene. Nullbeholdning regnes ikke som et plasseringsproblem." : "Spør Børre om plasseringene for å undersøke hva som er registrert."}</p></section>
          </div>
          <details className="mt-5 text-sm leading-6 text-snake-text-on-dark-muted"><summary className="cursor-pointer font-semibold text-snake-text-on-dark">Om datagrunnlaget</summary><p className="mt-3">Oversikten leses fra Snake når siden åpnes. Lesingen er ikke et låst øyeblikksbilde. Samtalen henter aktuelle registreringer ved hvert oppslag.</p><p className="mt-3">Shopify-tall er lagrede observasjoner og kan være eldre. Forskjeller er ikke bekreftede telleavvik. Manglende SKU og tomme lokasjoner er ikke automatisk feil.</p></details>
        </aside>
      </div>
    </Surface>
  </main></AuthenticatedAppShell>;
}
