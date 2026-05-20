"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Gauge,
  Info,
} from "lucide-react";

type IntelligenceAction = {
  title: string;
  description: string;
  href: string;
  priorityLabel: string;
};

type Props = {
  missingLocationCount: number;
  quantityDiffCount: number;
  locationsWithoutZoneCount: number;
  placedCount: number;
};

export default function SnakeIntelligencePanel({
  missingLocationCount,
  quantityDiffCount,
  locationsWithoutZoneCount,
  placedCount,
}: Props) {
  const action = getRecommendedAction({
    missingLocationCount,
    quantityDiffCount,
    locationsWithoutZoneCount,
    placedCount,
  });

  return (
    <section className="rounded-[28px] border border-emerald-400/35 bg-black/10 p-5 shadow-lg shadow-emerald-950/20 transition hover:border-emerald-300/50 hover:bg-black/15">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
          Snake Intelligence
        </p>
        <Info className="h-4 w-4 text-emerald-300/70" />
      </div>

      <h2 className="mt-3 text-xl font-semibold text-white">
        Neste anbefalte handling
      </h2>

     <Link
  href={action.href}
  className="group mt-4 block rounded-3xl border border-white/10 bg-black/10 p-4 transition hover:border-emerald-300/30 hover:bg-black/20"
>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-300">
  <Gauge className="h-5 w-5" />
</div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-semibold tracking-tight text-emerald-300">
                {action.title}
              </h3>

              <span className="w-fit rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">
                {action.priorityLabel}
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-white/65">
              {action.description}
            </p>

            <span className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-400/90 px-4 py-2.5 text-sm font-bold text-[#052f35] transition group-hover:bg-emerald-300">
  Start her
  <ArrowRight className="h-4 w-4" />
</span>
          </div>
        </div>
      </Link>

      <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-black/20 sm:grid-cols-4">
        <Metric
          icon="warn"
          value={missingLocationCount}
          label="uten lokasjon"
        />
        <Metric
          icon={locationsWithoutZoneCount > 0 ? "warn" : "ok"}
          value={locationsWithoutZoneCount}
          label="uten sone"
        />
        <Metric
          icon="warn"
          value={quantityDiffCount}
          label="quantity diff"
        />
        <Metric icon="ok" value={placedCount} label="plassert" />
      </div>
    </section>
  );
}

function getRecommendedAction({
  missingLocationCount,
  quantityDiffCount,
  locationsWithoutZoneCount,
}: Props): IntelligenceAction {
  if (quantityDiffCount > 0) {
    return {
      title: "Rydd lageravvik først",
      description: `${quantityDiffCount} produkter har avvik mellom Shopify og Snake. Dette bør ryddes før videre arbeid.`,
      href: "/products?status=diff",
      priorityLabel: "Høy prioritet",
    };
  }

  if (missingLocationCount > 0) {
    return {
      title: "Sett eksakte lokasjoner",
      description: `${missingLocationCount} produkter mangler fast plassering. Start med å plassere disse.`,
      href: "/products?status=missing",
      priorityLabel: "Neste steg",
    };
  }

  if (locationsWithoutZoneCount > 0) {
    return {
      title: "Rydd lokasjoner uten sone",
      description: `${locationsWithoutZoneCount} lokasjoner mangler sone. Dette bør ryddes for bedre struktur.`,
      href: "/locations",
      priorityLabel: "Struktur",
    };
  }

  return {
    title: "Lageret ser stabilt ut",
    description: "Snake finner ingen kritiske ryddeoppgaver akkurat nå.",
    href: "/products",
    priorityLabel: "Stabilt",
  };
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: "ok" | "warn";
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 border-white/10 px-4 py-3 sm:border-r last:border-r-0">
      {icon === "ok" ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
      ) : (
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
      )}

      <div>
        <p className="text-xl font-semibold text-white">{value}</p>
        <p className="text-xs text-white/50">{label}</p>
      </div>
    </div>
  );
}