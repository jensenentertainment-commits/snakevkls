"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";
import SnakeHero from "../components/SnakeHero";
import SnakeToolbar from "../components/SnakeToolbar";

type ActivityItem = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("activity_log")
      .select(`
        id,
        entity_type,
        entity_id,
        action,
        title,
        description,
        metadata,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) console.error(error);

    setActivities((data as ActivityItem[]) ?? []);
    setLoading(false);
  }

  const filteredActivities = useMemo(() => {
    if (actionFilter === "all") return activities;
    return activities.filter((item) => item.action === actionFilter);
  }, [activities, actionFilter]);

  const actions = useMemo(() => {
    return Array.from(new Set(activities.map((item) => item.action)));
  }, [activities]);

  const groupedActivities = useMemo(() => {
  const groups = new Map<string, ActivityItem[]>();

  filteredActivities.forEach((item) => {
    const key = getDateGroup(item.created_at);
    const existing = groups.get(key) ?? [];
    groups.set(key, [...existing, item]);
  });

  return Array.from(groups.entries());
}, [filteredActivities]);

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
          <SnakeHero
            eyebrow="SNAKE / Aktivitet"
            title="Aktivitet"
            description="Siste endringer i Snake. Sone, lokasjon, uttak og andre lagerhendelser logges her."
          />

          <SnakeToolbar
            left={
              <>
                <button
                  onClick={() => setActionFilter("all")}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    actionFilter === "all"
                      ? "bg-[#b58a14] text-white"
                      : "bg-white/10 text-white"
                  }`}
                >
                  Alle <span className="ml-1 opacity-70">{activities.length}</span>
                </button>

                {actions.map((action) => (
                  <button
                    key={action}
                    onClick={() => setActionFilter(action)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      actionFilter === action
                        ? "bg-[#b58a14] text-white"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {formatAction(action)}
                  </button>

                ))}
              </>
            }
            right={
              <button
                onClick={load}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950"
              >
                Oppdater
              </button>
            }
          />

          <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                    Aktivitetslogg
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {loading
                      ? "Henter aktivitet..."
                      : `${filteredActivities.length} av ${activities.length} hendelser vises`}
                  </p>
                </div>
              </div>

              {loading ? (
                <EmptyState text="Laster aktivitet..." />
              ) : filteredActivities.length === 0 ? (
                <EmptyState text="Ingen hendelser registrert." />
              ) : (
                <div className="divide-y divide-neutral-100">
  {groupedActivities.map(([dateLabel, items]) => (
    <div key={dateLabel}>
      <div className="bg-neutral-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 sm:px-6">
        {dateLabel}
      </div>

      <div className="divide-y divide-neutral-100">
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  ))}
</div>
              )}
            </div>
          </div>
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const productId =
    typeof item.metadata?.product_id === "string"
      ? item.metadata.product_id
      : null;

      const tone = getActivityTone(item.action);

  return (
    <div className="px-5 py-5 transition hover:bg-[#055a7d]/[0.025] sm:px-6">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#055a7d]/15 bg-[#055a7d]/8 text-[#055a7d] sm:h-12 sm:w-12">
          <Activity className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
  {formatAction(item.action)}
</span>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {item.entity_type}
            </span>
          </div>

          <h3 className="mt-2 text-base font-semibold leading-6 text-neutral-950">
            {item.title}
          </h3>

          {item.description && (
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              {item.description}
            </p>
          )}

          <p className="mt-2 text-xs font-semibold text-neutral-400">
            {new Date(item.created_at).toLocaleString("nb-NO")}
          </p>

          {productId && (
            <Link
              href={`/products/${productId}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#055a7d] underline-offset-4 hover:underline"
            >
              Åpne produkt
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function getDateGroup(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "I dag";
  if (sameDay(date, yesterday)) return "I går";

  return date.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    zone_set: "Sone satt",
    batch_zone_set: "Batch sone",
    location_set: "Lokasjon satt",
    manual_stock_movement: "Uttak / korrigering",
    product_added_to_location: "Produkt lagt til",
    quantity_updated: "Antall endret",
    removed_from_location: "Fjernet fra lokasjon",
    shopify_sync_completed: "Shopify sync fullført",
    shopify_sync_failed: "Shopify sync feilet",
  };

  return labels[action] ?? action;
}

function getActivityTone(action: string) {
  const tones: Record<string, string> = {
    manual_stock_movement: "border-red-200 bg-red-50 text-red-700",
    removed_from_location: "border-red-200 bg-red-50 text-red-700",

    zone_set: "border-amber-200 bg-amber-50 text-amber-700",
    batch_zone_set: "border-purple-200 bg-purple-50 text-purple-700",

    location_set: "border-blue-200 bg-blue-50 text-blue-700",
    product_added_to_location: "border-green-200 bg-green-50 text-green-700",
    quantity_updated: "border-neutral-300 bg-neutral-100 text-neutral-700",

    shopify_sync_completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    shopify_sync_failed: "border-red-200 bg-red-50 text-red-700",
  };

  return tones[action] ?? "border-neutral-200 bg-neutral-100 text-neutral-600";
}
function EmptyState({ text }: { text: string }) {
  return <div className="px-6 py-10 text-sm text-neutral-500">{text}</div>;
}