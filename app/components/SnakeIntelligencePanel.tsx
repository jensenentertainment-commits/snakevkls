"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
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
    0,
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
    <section className="rounded-snake-card border border-snake-border-on-dark-default bg-snake-app-elevated p-5 shadow-snake-panel sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[length:var(--snake-text-eyebrow-size)] font-[var(--snake-font-weight-semibold)] uppercase leading-[var(--snake-text-eyebrow-line-height)] tracking-[var(--snake-text-eyebrow-tracking)] text-snake-text-on-dark-muted">
              Lagerstatus
            </p>
            <span className="text-[length:var(--snake-text-meta-size)] text-snake-text-on-dark-muted">
              Vurdert av Børre
            </span>
          </div>

          <h2 className="mt-2 text-[length:var(--snake-text-title-size)] font-[var(--snake-font-weight-semibold)] leading-[var(--snake-text-title-line-height)] tracking-[var(--snake-text-title-tracking)] text-snake-text-on-dark">
            Prioritert nå
          </h2>

          <p className="mt-2 max-w-3xl text-[length:var(--snake-text-body-small-size)] leading-[var(--snake-text-body-small-line-height)] text-snake-text-on-dark-muted">
            {borre.message}
          </p>
        </div>

        <Link
          href={action.href}
          className="group flex min-h-11 items-center justify-between gap-4 rounded-snake-control border border-snake-border-on-dark-default bg-snake-brand-soft px-4 py-3 text-snake-text-on-dark transition-colors hover:border-snake-border-on-dark-strong hover:bg-snake-brand-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark motion-reduce:transition-none"
        >
          <span>
            <span className="block text-[length:var(--snake-text-meta-size)] font-[var(--snake-font-weight-semibold)] uppercase tracking-[var(--snake-text-eyebrow-tracking)] text-snake-text-on-dark-muted">
              Anbefalt handling
            </span>
            <span className="mt-1 block text-[length:var(--snake-text-label-size)] font-[var(--snake-font-weight-semibold)]">
              {action.title}
            </span>
          </span>
          <ArrowRight
            className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </Link>
      </div>

      <div className="mt-4 grid overflow-hidden rounded-snake-control border border-snake-border-on-dark-subtle sm:grid-cols-3">
        <Metric
          value={quantityDiffCount}
          label="Quantity diff"
          href="/products?status=diff"
        />
        <Metric
          value={missingLocationCount}
          label="Uten lokasjon"
          href="/fix-locations"
        />
        <Metric
          value={locationsWithoutZoneCount}
          label="Uten sone"
          href="/locations"
        />
      </div>
    </section>
  );
}

function Metric({
  value,
  label,
  href,
}: {
  value: number;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-3 border-b border-snake-border-on-dark-subtle px-4 py-3 text-snake-text-on-dark transition-colors last:border-b-0 hover:bg-snake-brand-soft focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-snake-focus-on-dark sm:border-b-0 sm:border-r sm:last:border-r-0 motion-reduce:transition-none"
    >
      <AlertTriangle
        className="h-5 w-5 shrink-0 text-snake-warning"
        aria-hidden="true"
      />
      <span>
        <span className="block text-[length:var(--snake-text-title-size)] font-[var(--snake-font-weight-semibold)] leading-none">
          {value}
        </span>
        <span className="mt-1 block text-[length:var(--snake-text-meta-size)] text-snake-text-on-dark-muted">
          {label}
        </span>
      </span>
    </Link>
  );
}
