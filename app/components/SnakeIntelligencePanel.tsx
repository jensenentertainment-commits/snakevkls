"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Gauge,
  Info,
} from "lucide-react";
import {
  getRecommendedAction,
  getWarehouseHealth,
} from "@/lib/snake-intelligence";
import { useEffect, useState } from "react";

type OperationalSignal = {
  type: "needs-check" | "location-diff";
  level: "medium" | "high" | "critical";
  title: string;
  description: string;
  href: string;
  count: number;
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
  const metrics = {
    missingLocationCount,
    quantityDiffCount,
    locationsWithoutZoneCount,
    placedCount,
  };

  const action = getRecommendedAction(metrics);
  const health = getWarehouseHealth(metrics);
  
const [signals, setSignals] = useState<OperationalSignal[]>([]);
const signalCount = signals.reduce(
  (sum, signal) => sum + signal.count,
  0
);
useEffect(() => {
  async function loadSignals() {
    try {
      const res = await fetch("/api/snake-intelligence/signals", {
        cache: "no-store",
      });

      const json = await res.json();

      if (res.ok) {
        setSignals(json.signals ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  }

  loadSignals();
}, []);

  return (
    <section className="rounded-[28px] border border-emerald-400/35 bg-black/10 p-5 shadow-lg shadow-emerald-950/20 transition hover:border-emerald-300/50 hover:bg-black/15">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
          Snake Intelligence
        </p>
        <Info className="h-4 w-4 text-emerald-300/70" />
      </div>

      <div className="mt-3 flex items-start justify-between gap-4">
  <div>
    <h2 className="text-xl font-semibold text-white">
      Neste anbefalte handling
    </h2>

    <p className="mt-1 text-sm text-white/50">
      Snake Health {health.score}/100
    </p>
  </div>

  <span
    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
      health.level === "stable"
        ? "bg-emerald-400/10 text-emerald-300"
        : health.level === "medium"
          ? "bg-amber-400/10 text-amber-300"
          : "bg-red-400/10 text-red-300"
    }`}
  >
    {health.level}
  </span>
</div>

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

     




      <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-black/20 sm:grid-cols-5">
     <Metric
  icon={signalCount > 0 ? "warn" : "ok"}
  value={signalCount}
  label="bør sjekkes"
  href="/activities"
/>

<Metric
  icon="warn"
  value={missingLocationCount}
  label="uten lokasjon"
  href="/fix-locations"
/>

<Metric
  icon={locationsWithoutZoneCount > 0 ? "warn" : "ok"}
  value={locationsWithoutZoneCount}
  label="uten sone"
  href="/locations"
/>

<Metric
  icon="warn"
  value={quantityDiffCount}
  label="quantity diff"
  href="/products?status=diff"
/>

<Metric
  icon="ok"
  value={placedCount}
  label="plassert"
  href="/products"
/>
      </div>
    </section>
  );
}


function Metric({
  icon,
  value,
  label,
  href,
}: {
  icon: "ok" | "warn";
  value: number;
  label: string;
  href?: string;
}) {

  
  const content = (
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

  if (!href) return content;

  return (
    <Link
      href={href}
      className="block transition hover:bg-white/[0.04]"
    >
      {content}
    </Link>
  );
}