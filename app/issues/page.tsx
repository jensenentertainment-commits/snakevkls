"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LagerToolbar } from "../components/lager/LagerToolbar";
import { LagerHero } from "../components/lager/LagerHero";
import { LagerViewTabs } from "../components/lager/LagerViewTabs";


type Severity = "critical" | "warning" | "info";
type IssueFilter = "all" | Severity;

type ProductRow = {
  id: string;
  sku: string | null;
  product_name: string;
  variant_name: string | null;
  inventory: {
  id: string;
  quantity: number;
  zone_id: string | null;
  locations: {
    id: string;
    code: string;
  } | null;
}[];
};

type LocationRow = {
  id: string;
  code: string;
  active: boolean;
  zone_id: string | null;
  zones: {
    id: string;
    code: string;
    name: string;
  } | null;
  inventory: { id: string }[];
};

type IssueItem = {
  id: string;
  severity: Severity;
  type: string;
  title: string;
  description: string;
  meta?: string;
  href: string;
  action: string;
};

export default function IssuesPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<IssueFilter>("all");
  

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [productsRes, locationsRes] = await Promise.all([
      supabase
        .from("products")
        .select(`
          id,
          sku,
          product_name,
          variant_name,
          inventory (
  id,
  quantity,
  zone_id,
  locations (
              id,
              code
            )
          )
        `)
        .eq("active", true)
        .order("product_name", { ascending: true }),

      supabase
        .from("locations")
        .select(`
          id,
          code,
          active,
          zone_id,
          zones (
            id,
            code,
            name
          ),
          inventory (
            id
          )
        `)
        .order("code", { ascending: true }),
    ]);

    if (productsRes.error) console.error("Feil ved henting av produkter:", productsRes.error);
    if (locationsRes.error) console.error("Feil ved henting av lokasjoner:", locationsRes.error);

    setProducts((productsRes.data as unknown as ProductRow[]) ?? []);
    setLocations((locationsRes.data as unknown as LocationRow[]) ?? []);
    setLoading(false);
  }

  const issues = useMemo(() => {
    const productsWithoutZone = products.filter((product) => {
  const inventory = product.inventory?.[0];
  return !inventory?.zone_id;
});

const productsWithoutLocation = products.filter((product) => {
  const inventory = product.inventory?.[0];
  return inventory?.zone_id && !inventory.locations;
});
    const productsWithoutSku = products.filter((product) => !product.sku);

    const productsWithMultipleLocations = products.filter(
      (product) => (product.inventory?.length ?? 0) > 1
    );

    const locationsWithoutProducts = locations.filter(
      (location) => (location.inventory?.length ?? 0) === 0
    );

    const locationsWithoutZone = locations.filter(
      (location) => !location.zone_id
    );

    const list: IssueItem[] = [
      ...productsWithoutZone.map((product) => ({
  id: `product-zone-${product.id}`,
  severity: "critical" as const,
  type: "Produkt uten sone",
  title: product.sku || "Produkt uten SKU",
  description: product.product_name,
  meta: product.variant_name || undefined,
  href: "/products?status=missing",
  action: "Sett sone",
})),

...productsWithoutLocation.map((product) => ({
  id: `product-location-${product.id}`,
  severity: "warning" as const,
  type: "Produkt uten lokasjon",
  title: product.sku || "Produkt uten SKU",
  description: product.product_name,
  meta: product.variant_name || undefined,
  href: "/fix-locations",
  action: "Sett lokasjon",
})),

      ...productsWithoutSku.map((product) => ({
        id: `product-sku-${product.id}`,
        severity: "critical" as const,
        type: "Produkt uten SKU",
        title: product.product_name,
        description: "Produkt mangler SKU og blir vanskeligere å finne i søk.",
        meta: product.variant_name || undefined,
        href: "/products",
        action: "Kontroller produkt",
      })),

      ...productsWithMultipleLocations.map((product) => ({
        id: `product-multi-${product.id}`,
        severity: "warning" as const,
        type: "Flere lokasjoner",
        title: product.sku || "Produkt uten SKU",
        description: product.product_name,
        meta:
          product.inventory
            ?.map((item) => item.locations?.code)
            .filter(Boolean)
            .join(", ") || undefined,
        href: "/products",
        action: "Kontroller",
      })),

      ...locationsWithoutZone.map((location) => ({
        id: `location-zone-${location.id}`,
        severity: "warning" as const,
        type: "Lokasjon uten sone",
        title: location.code,
        description: "Lokasjonen bør knyttes til en sone for ryddigere struktur.",
        meta: location.active ? "Aktiv" : "Inaktiv",
        href: "/locations",
        action: "Legg til sone",
      })),

      ...locationsWithoutProducts.map((location) => ({
        id: `location-empty-${location.id}`,
        severity: "info" as const,
        type: "Tom lokasjon",
        title: location.code,
        description:
          "Lokasjonen har ingen registrerte produkter. Dette kan være riktig, men bør være bevisst.",
        meta: location.zones
          ? `${location.zones.code} — ${location.zones.name}`
          : "Mangler sone",
        href: "/locations",
        action: "Se lokasjon",
      })),
    ];

    return {
  productsWithoutZone,
  productsWithoutLocation,
      productsWithoutSku,
      productsWithMultipleLocations,
      locationsWithoutProducts,
      locationsWithoutZone,
      list,
    };
  }, [products, locations]);

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
  description="Lagerdata som kan skape feil i søk, lokasjon og plukk.
                Kritiske avvik bør ryddes først"
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
          {issues.productsWithoutZone.length +
  issues.productsWithoutLocation.length +
  issues.productsWithoutSku.length +
  issues.productsWithMultipleLocations.length}
        </span>
      </div>

      <div className="rounded-snake-control bg-snake-app-elevated px-3 py-2 text-sm font-semibold text-snake-text-on-dark">
        Lokasjon{" "}
        <span className="ml-1 text-snake-text-on-dark-muted">
          {issues.locationsWithoutProducts.length + issues.locationsWithoutZone.length}
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
      {loading
        ? "Børre henter avvik."
        : criticalCount > 0
          ? `Børre ser ${criticalCount} kritiske avvik. Start der før lageret begynner å improvisere.`
          : warningCount > 0
            ? `Børre ser ${warningCount} ting som bør sjekkes. Ikke krise, men heller ikke pynt.`
            : totalIssues > 0
              ? `Børre ser ${totalIssues} avvik totalt. Det meste virker håndterbart.`
              : "Børre finner ingen avvik akkurat nå. Dette er sjelden nok til å nevnes."}
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

              {loading ? (
                <EmptyState text="Laster avvik..." />
              ) : filteredIssues.length === 0 ? (
                <EmptyState text="Ingen avvik funnet. Mistenkelig ryddig." />
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
                  ["Uten sone", issues.productsWithoutZone.length],
["Uten lokasjon", issues.productsWithoutLocation.length],
                  ["Uten SKU", issues.productsWithoutSku.length],
                  ["Flere lokasjoner", issues.productsWithMultipleLocations.length],
                ]}
              />

              <MiniSection
                title="Lokasjoner"
                items={[
                  ["Tomme lokasjoner", issues.locationsWithoutProducts.length],
                  ["Uten sone", issues.locationsWithoutZone.length],
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
