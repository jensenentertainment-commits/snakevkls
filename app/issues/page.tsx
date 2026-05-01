"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
 
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";
import SnakeToolbar from "../components/SnakeToolbar";
import SnakeHero from "../components/SnakeHero";

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
    const productsWithoutLocation = products.filter(
      (product) => !product.inventory || product.inventory.length === 0
    );

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
      ...productsWithoutLocation.map((product) => ({
        id: `product-location-${product.id}`,
        severity: "critical" as const,
        type: "Produkt uten lokasjon",
        title: product.sku || "Produkt uten SKU",
        description: product.product_name,
        meta: product.variant_name || undefined,
       href: "/products?status=missing",
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
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
          <SnakeHero
  eyebrow="SNAKE / Avvik"
  title="Avvik"
  description="Lagerdata som kan skape feil i søk, lokasjon og plukk.
                Kritiske avvik bør ryddes først"
  searchValue={query}
  onSearchChange={setQuery}
  searchPlaceholder="SKU, produktnavn, sone eller lokasjon"
/>

         <SnakeToolbar
  left={
    <>
      {[
        { key: "all", label: "Alle", value: totalIssues },
        { key: "critical", label: "Kritisk", value: criticalCount },
        { key: "warning", label: "Sjekk", value: warningCount },
        { key: "info", label: "Info", value: infoCount },
      ].map((filter) => (
        <button
          key={filter.key}
          onClick={() => setSeverityFilter(filter.key as IssueFilter)}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            severityFilter === filter.key
              ? "bg-[#b58a14] text-white"
              : "bg-white/10 text-white"
          }`}
        >
          {filter.label}
          <span className="ml-1 opacity-70">
            {loading ? "…" : filter.value}
          </span>
        </button>
      ))}
    </>
  }
  right={
    <>
      <div className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white">
        Produkt{" "}
        <span className="ml-1 text-white/65">
          {issues.productsWithoutLocation.length +
            issues.productsWithoutSku.length +
            issues.productsWithMultipleLocations.length}
        </span>
      </div>

      <div className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white">
        Lokasjon{" "}
        <span className="ml-1 text-white/65">
          {issues.locationsWithoutProducts.length + issues.locationsWithoutZone.length}
        </span>
      </div>
    </>
  }
/>

          <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                    Prioritert arbeidsliste
                  </h2>

                  <p className="mt-1 text-sm text-neutral-500">
                    {loading
                      ? "Henter avvik..."
                      : `${filteredIssues.length} av ${totalIssues} avvik vises`}
                  </p>
                </div>

                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:w-auto sm:py-2"
                  >
                    Nullstill søk
                  </button>
                )}
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

        <SnakeFooter />
      </div>
    </main>
  );
}

function IssueRow({ issue }: { issue: IssueItem }) {
  const severityStyles = {
    critical: {
      icon: "bg-red-50 text-red-600 border-red-100",
      pill: "bg-red-50 text-red-700 border-red-200",
      label: "Kritisk",
    },
    warning: {
      icon: "bg-[#a77e05]/10 text-[#a77e05] border-[#a77e05]/20",
      pill: "bg-[#a77e05]/10 text-[#a77e05] border-[#a77e05]/20",
      label: "Sjekk",
    },
    info: {
      icon: "bg-[#055a7d]/8 text-[#055a7d] border-[#055a7d]/15",
      pill: "bg-neutral-100 text-neutral-600 border-neutral-200",
      label: "Info",
    },
  }[issue.severity];

  return (
    <div className="px-5 py-5 transition hover:bg-[#055a7d]/[0.025] sm:px-6">
      <div className="flex gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border sm:h-12 sm:w-12 ${severityStyles.icon}`}
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

            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {issue.type}
            </span>
          </div>

          <h3 className="mt-2 text-base font-semibold leading-6 text-neutral-950">
            {issue.title}
          </h3>

          <p className="mt-1 text-sm leading-6 text-neutral-600">
            {issue.description}
          </p>

          {issue.meta && (
            <p className="mt-2 text-xs font-semibold text-neutral-400">
              {issue.meta}
            </p>
          )}

          <Link
            href={issue.href}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#04495f] sm:w-auto sm:bg-white sm:text-[#055a7d] sm:ring-1 sm:ring-neutral-300 sm:hover:bg-neutral-50"
          >
            {issue.action}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
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
    <section className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>

      <div className="mt-4 space-y-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm"
          >
            <span className="text-neutral-600">{label}</span>
            <span className="font-semibold text-neutral-950">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-6 py-10 text-sm text-neutral-500">{text}</div>;
}