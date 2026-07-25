"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LagerHero } from "../components/lager/LagerHero";
import { LagerToolbar } from "../components/lager/LagerToolbar";
import { LagerViewTabs } from "../components/lager/LagerViewTabs";
import ActivityItemCard from "../components/activity/ActivityItemCard";
import { formatAction } from "../components/activity/utils";

type ActivityItem = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  actor_email: string | null;
  actor_name: string | null;
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
        actor_email,
        actor_name,
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
    <>
        <section className="overflow-hidden rounded-snake-card bg-snake-surface text-snake-text-primary shadow-snake-overlay sm:rounded-snake-shell">
          <LagerHero
            eyebrow="SNAKE / Aktivitet"
            title="Aktivitetslogg"
            description="Siste lagerhendelser i Snake. Lokasjoner, tellinger, uttak og andre operasjonelle endringer logges fortløpende."
          />

          <LagerToolbar
            left={
              <LagerViewTabs
                activeId={actionFilter}
                ariaLabel="Aktivitetsvisning"
                items={[
                  { id: "all", label: "Alle", count: activities.length },
                  ...actions.map((action) => ({
                    id: action,
                    label: formatAction(action),
                  })),
                ]}
                onChange={setActionFilter}
              />
            }
            right={
              <button
                onClick={load}
                className="rounded-snake-control border border-snake-border-on-dark-subtle bg-snake-app-elevated px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-snake-text-on-dark-muted transition hover:bg-snake-app-elevated/90 hover:text-snake-text-on-dark"
              >
                Oppdater
              </button>
            }
          />

          <div className="border-t border-snake-border-default bg-snake-surface px-5 py-6 sm:px-8 sm:py-7">
            <div className="overflow-hidden rounded-snake-card border border-snake-border-default bg-snake-surface">
              <div className="flex items-center justify-between border-b border-snake-border-default bg-snake-surface-subtle px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-snake-text-primary">
                    Aktivitetslogg
                  </h2>

                  <p className="mt-1 text-sm text-snake-text-muted">
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
                      <div className="bg-snake-surface-subtle/80 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-snake-text-disabled sm:px-6">
                        {dateLabel}
                      </div>

                      <div className="divide-y divide-neutral-100">
                        {items.map((item) => (
                          <ActivityItemCard key={item.id} item={item} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

    </>
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

function EmptyState({ text }: { text: string }) {
 return (
  <div className="px-6 py-14 text-center text-sm text-snake-text-muted">
    {text}
  </div>
);
}
