"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Layers,
  MapPinOff,
  PackageX,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";

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
  severity: "critical" | "warning" | "info";
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

  useEffect(() => {
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

      if (productsRes.error) {
        console.error("Feil ved henting av produkter:", productsRes.error);
      } else {
        setProducts((productsRes.data as ProductRow[]) ?? []);
      }

      if (locationsRes.error) {
        console.error("Feil ved henting av lokasjoner:", locationsRes.error);
      } else {
        setLocations((locationsRes.data as LocationRow[]) ?? []);
      }

      setLoading(false);
    }

    loadData();
  }, []);

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
        href: "/products",
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
    const q = query.trim().toLowerCase();
    if (!q) return issues.list;

    return issues.list.filter((issue) =>
      [issue.type, issue.title, issue.description, issue.meta ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [issues.list, query]);

  const totalIssues = issues.list.length;
  const criticalCount = issues.list.filter((i) => i.severity === "critical").length;
  const warningCount = issues.list.filter((i) => i.severity === "warning").length;
  const infoCount = issues.list.filter((i) => i.severity === "info").length;

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
        <SnakeNav />

        <section className="overflow-hidden rounded-[32px] bg-white text-neutral-950 shadow-2xl shadow-black/30">
          <div className="grid gap-7 bg-gradient-to-br from-[#055a7d] to-[#042834] px-5 py-7 text-white sm:px-8 sm:py-9 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10 lg:py-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
                SNAKE / Avvik
              </p>

              <h1 className="mt-3 text-4xl font-semibold leading-[0.95] tracking-[-0.04em] sm:mt-4 sm:text-5xl">
  Avvik som trenger handling.
</h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
                Her samles lagerdata som kan skape feil i søk, lokasjon og plukk.
                Start øverst — kritiske avvik bør ryddes først.
              </p>
            </div>

            <div className="rounded-3xl bg-white/12 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                Totale avvik
              </p>
              <p className="mt-2 text-5xl font-semibold tracking-tight">
                {loading ? "…" : totalIssues}
              </p>
            </div>
          </div>

          <div className="grid gap-3 bg-[#f6f7f8] px-5 py-5 sm:grid-cols-2 sm:px-8 sm:py-6 lg:grid-cols-4">
            <StatCard icon={<AlertTriangle />} label="Kritisk" value={criticalCount} tone="danger" />
            <StatCard icon={<Layers />} label="Bør sjekkes" value={warningCount} tone="gold" />
            <StatCard icon={<CheckCircle2 />} label="Info" value={infoCount} tone="neutral" />
            <StatCard icon={<MapPinOff />} label="Totalt" value={totalIssues} tone="blue" />
          </div>

          <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-8">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Prioritert arbeidsliste
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Sortert etter alvorlighet. Bruk denne som ryddeliste før plukk.
                </p>
              </div>

              <div className="relative w-full lg:w-[360px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Søk i avvik"
                  className="w-full rounded-2xl border border-neutral-300 bg-white py-3.5 pl-12 pr-4 text-sm outline-none transition focus:border-[#055a7d]"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
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

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
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

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "danger" | "gold" | "neutral" | "blue";
}) {
  const styles = {
    danger: "border-t-red-500 text-red-600",
    gold: "border-t-[#a77e05] text-[#a77e05]",
    neutral: "border-t-neutral-300 text-neutral-500",
    blue: "border-t-[#055a7d] text-[#055a7d]",
  };

  return (
    <div
      className={`rounded-2xl border border-neutral-200 border-t-4 bg-white p-5 shadow-sm ${styles[tone]}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">
            {value}
          </p>
        </div>

        <div className="[&>svg]:h-6 [&>svg]:w-6">{icon}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-6 py-10 text-sm text-neutral-500">{text}</div>;
}