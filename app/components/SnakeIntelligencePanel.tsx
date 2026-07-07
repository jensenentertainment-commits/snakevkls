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
} from "@/lib/intelligence/snake-intelligence";
import { useEffect, useState } from "react";
import { getBorreBrief } from "@/lib/intelligence/get-borre-brief";

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

const borre = getBorreBrief({
  diffCount: quantityDiffCount,
  missingLocationCount,
  missingZoneCount: locationsWithoutZoneCount,
  warehouseHealth: health.score,
  unresolvedIssues: signalCount,
  pickEnabled: false,
});

useEffect(() => {
  async function loadSignals() {
    try {
      const res = await fetch("/api/snake-intelligence/signals", {
  cache: "no-store",
});

if (!res.ok) {
  setSignals([]);
  return;
}

const json = await res.json();
setSignals(json.signals ?? []);
    } catch (error) {
      console.error(error);
    }
  }

  loadSignals();
}, []);

 return (
  <section className="rounded-[28px] border border-white/10 bg-black/10 p-5 shadow-lg shadow-black/20">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b58a14]">
            {borre.title} / {borre.eyebrow}
          </p>
          <Info className="h-4 w-4 text-emerald-300/70" />
        </div>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
          Børres vurdering
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/70">
          {borre.message}
        </p>

        <div className="mt-4">
  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
    <span>Snake Health</span>
    <span>{health.score}/100</span>
  </div>

  <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/30">
    <div
      className={`h-full rounded-full transition-all duration-700 ${
        health.score >= 80
          ? "bg-emerald-400"
          : health.score >= 50
            ? "bg-amber-400"
            : "bg-red-400"
      }`}
      style={{ width: `${Math.max(health.score, 4)}%` }}
    />
  </div>
</div>

        {borre.pulse ? (
          <p className="mt-2 text-xs italic text-white/45">
            {borre.pulse}
          </p>
        ) : null}
      </div>

      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
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
      className="group mt-5 block rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-emerald-300/30 hover:bg-white/[0.07]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/40">
            Børre ville startet her
          </p>

          <h3 className="mt-2 text-xl font-black tracking-tight text-emerald-300">
            {action.title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-white/65">
            {action.description}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-400/90 px-4 py-2.5 text-sm font-black text-[#052f35] transition group-hover:bg-emerald-300">
          Start her
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>


    <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-black/20 sm:grid-cols-5">
      <Metric icon={signalCount > 0 ? "warn" : "ok"} value={signalCount} label="bør sjekkes" href="/activities" />
      <Metric icon="warn" value={missingLocationCount} label="uten lokasjon" href="/fix-locations" />
      <Metric icon={locationsWithoutZoneCount > 0 ? "warn" : "ok"} value={locationsWithoutZoneCount} label="uten sone" href="/locations" />
      <Metric icon="warn" value={quantityDiffCount} label="quantity diff" href="/products?status=diff" />
      <Metric icon="ok" value={placedCount} label="plassert" href="/products" />
    </div>
  </section>
);


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
}