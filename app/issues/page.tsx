"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { inventoryIssues, readAllIssuePages, type IssueItem, type IssueProduct, type IssueInventory, type IssueLocation } from "@/lib/inventory/issues";
import { supabase } from "@/lib/supabase";
import { LagerToolbar } from "../components/lager/LagerToolbar";
import { LagerHero } from "../components/lager/LagerHero";
import { LagerViewTabs } from "../components/lager/LagerViewTabs";


type Severity = "critical" | "warning" | "info";
type IssueFilter = "all" | Severity;

export default function IssuesPage() {
  const [products, setProducts] = useState<IssueProduct[]>([]);
  const [locations, setLocations] = useState<IssueLocation[]>([]);
  const [inventory, setInventory] = useState<IssueInventory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<IssueFilter>("all");
  

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true); setError(null);
    try {
      const [products, inventory, locations] = await Promise.all([
        readAllIssuePages<IssueProduct>((from, to) => supabase.from("products").select("id,sku,product_name,variant_name").order("id").range(from,to)),
        readAllIssuePages<IssueInventory>((from, to) => supabase.from("inventory").select("id,product_id,quantity,location_id,zone_id").order("id").range(from,to)),
        readAllIssuePages<IssueLocation>((from, to) => supabase.from("locations").select("id,code,active,zone_id,zones(id,code)").order("id").range(from,to) as unknown as PromiseLike<{data: IssueLocation[] | null; error: unknown}>),
      ]);
      setProducts(products); setInventory(inventory); setLocations(locations);
    } catch(error) {
      setProducts([]); setInventory([]); setLocations([]);
      setError(error instanceof Error ? error.message : "Kunne ikke hente avviksgrunnlaget");
    } finally { setLoading(false); }
  }

  const issues = useMemo(() => inventoryIssues(products, inventory, locations), [products, inventory, locations]);

  const filteredIssues = useMemo(() => {
    let result = issues.list;

    if (severityFilter !== "all") {
      result = result.filter((issue) => issue.severity === severityFilter);
    }

    const q = query.trim().toLowerCase();

    if (q) {
      result = result.filter((issue) =>
        [issue.type, issue.title, issue.description, issue.meta ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    return result;
  }, [issues.list, query, severityFilter]);

  const totalIssues = issues.list.length;
  const criticalCount = issues.list.filter((i) => i.severity === "critical").length;
  const warningCount = issues.list.filter((i) => i.severity === "warning").length;
  const infoCount = issues.list.filter((i) => i.severity === "info").length;

  return (
    <>
        <section className="overflow-hidden rounded-snake-card bg-snake-surface text-snake-text-primary shadow-snake-overlay sm:rounded-snake-shell">
          <LagerHero
  eyebrow="SNAKE / Avvik"
  title="Avvik"
  description="Registrerte forhold som bør kontrolleres. Fysisk lagerregistrering kan være ufullstendig; listen bekrefter ikke fysiske lagerfeil."
  searchValue={query}
  onSearchChange={setQuery}
  searchPlaceholder="SKU, produktnavn, sone eller lokasjon"
/>

         <LagerToolbar
  left={
    <LagerViewTabs
      activeId={severityFilter}
      ariaLabel="Avviksvisning"
      items={[
        { id: "all", label: "Alle", count: loading ? "…" : totalIssues },
        { id: "critical", label: "Kritisk", count: loading ? "…" : criticalCount },
        { id: "warning", label: "Sjekk", count: loading ? "…" : warningCount },
        { id: "info", label: "Info", count: loading ? "…" : infoCount },
      ]}
      onChange={(id) => setSeverityFilter(id as IssueFilter)}
    />
  }
  right={
    <>
      <div className="rounded-snake-control border border-snake-border-on-dark-subtle bg-snake-app-elevated px-3 py-2 text-sm font-semibold text-snake-text-on-dark">
        Produkt{" "}
        <span className="ml-1 text-snake-text-on-dark-muted">
          {issues.productCount}
        </span>
      </div>

      <div className="rounded-snake-control bg-snake-app-elevated px-3 py-2 text-sm font-semibold text-snake-text-on-dark">
        Lokasjon{" "}
        <span className="ml-1 text-snake-text-on-dark-muted">
          {issues.locationCount}
        </span>
      </div>
    </>
  }
/>

          <div className="border-t border-snake-border-default bg-snake-surface px-5 py-6 sm:px-8 sm:py-7">
            <div className="overflow-hidden rounded-snake-action border border-snake-border-default bg-snake-surface shadow-snake-card">
             <div className="flex flex-col gap-3 border-b border-snake-border-default bg-snake-surface-subtle px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
  <div>
    <h2 className="text-lg font-semibold tracking-tight text-snake-text-primary">
      Prioritert arbeidsliste
    </h2>

    <p className="mt-1 text-sm text-snake-text-secondary">
      {error ? "Avviksgrunnlaget er ikke tilgjengelig." : loading ? "Henter registrerte lagerforhold." : totalIssues > 0 ? totalIssues + " registrerte forhold bør kontrolleres." : "Ingen registreringsforhold funnet med disse kontrollene."}
    </p>
  </div>

  <div className="flex flex-col gap-2 sm:items-end">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-snake-text-disabled">
      {loading
        ? "Henter avvik"
        : `Viser ${filteredIssues.length} av ${totalIssues}`}
    </p>

    {query && (
      <button
        onClick={() => setQuery("")}
        className="w-full rounded-snake-action border border-snake-border-strong bg-snake-surface px-4 py-3 text-sm font-semibold text-snake-text-secondary transition hover:bg-snake-surface-subtle sm:w-auto sm:py-2"
      >
        Nullstill søk
      </button>
    )}
  </div>
</div>

              {error ? (
                <div role="alert" className="p-6"><p>{error}</p><button className="mt-3 underline" onClick={loadData}>Prøv igjen</button></div>
              ) : loading ? (
                <EmptyState text="Laster avvik..." />
              ) : filteredIssues.length === 0 ? (
                <EmptyState text="Ingen registreringsforhold i dette utvalget." />
              ) : (
                <div className="divide-y divide-neutral-100">
                  {filteredIssues.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <MiniSection
                title="Produkter"
                items={[
                  ["Lagerposter til kontroll", issues.productCount],
                ]}
              />

              <MiniSection
                title="Lokasjoner"
                items={[
                  ["Aktive uten gyldig sone", issues.locationCount],
                ]}
              />
            </div>
          </div>
        </section>

    </>
  );
}

function IssueRow({ issue }: { issue: IssueItem }) {
  const severityStyles = {
    critical: {
      icon: "bg-snake-danger-surface text-snake-danger border-snake-danger-border",
      pill: "bg-snake-danger-surface text-snake-danger border-snake-danger-border",
      label: "Kritisk",
    },
    warning: {
      icon: "bg-snake-brand-strong/10 text-snake-brand-strong border-snake-brand-strong/20",
      pill: "bg-snake-brand-strong/10 text-snake-brand-strong border-snake-brand-strong/20",
      label: "Sjekk",
    },
    info: {
      icon: "bg-snake-primary/8 text-snake-link border-snake-primary/15",
      pill: "bg-snake-neutral-surface text-snake-text-secondary border-snake-border-default",
      label: "Info",
    },
  }[issue.severity];

  return (
    <div className="px-5 py-5 transition hover:bg-snake-primary/[0.025] sm:px-6">
      <div className="flex gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-snake-action border sm:h-12 sm:w-12 ${severityStyles.icon}`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severityStyles.pill}`}
            >
              {severityStyles.label}
            </span>

            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-snake-text-disabled">
              {issue.type}
            </span>
          </div>

          <h3 className="mt-2 text-base font-semibold leading-6 text-snake-text-primary">
            {issue.title}
          </h3>

          <p className="mt-1 text-sm leading-6 text-snake-text-secondary">
            {issue.description}
          </p>

          {issue.meta && (
            <p className="mt-2 text-xs font-semibold text-snake-text-disabled">
              {issue.meta}
            </p>
          )}

          <Link
            href={issue.href}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-snake-action bg-snake-primary px-4 py-3 text-sm font-semibold text-snake-text-on-dark transition hover:bg-snake-primary-hover sm:w-auto sm:bg-snake-surface sm:text-snake-link sm:ring-1 sm:ring-snake-border-strong sm:hover:bg-snake-surface-subtle"
          >
            {issue.action}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}



function MiniSection({
  title,
  items,
}: {
  title: string;
  items: [string, number][];
}) {
  return (
    <section className="rounded-snake-card border border-snake-border-default bg-snake-surface-subtle p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>

      <div className="mt-4 space-y-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-snake-action bg-snake-surface px-4 py-3 text-sm"
          >
            <span className="text-snake-text-secondary">{label}</span>
            <span className="font-semibold text-snake-text-primary">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-6 py-10 text-sm text-snake-text-muted">{text}</div>;
}
