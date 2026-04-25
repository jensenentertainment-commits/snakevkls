"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Search, Layers, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";

type Zone = {
  id: string;
  code: string;
  name: string;
  active: boolean;
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

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newZoneId, setNewZoneId] = useState("");
  const [newActive, setNewActive] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);

    const [zonesRes, locationsRes] = await Promise.all([
      supabase
        .from("zones")
        .select("id, code, name, active")
        .order("code", { ascending: true }),

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

    if (zonesRes.error) console.error("Feil ved henting av soner:", zonesRes.error);
    if (locationsRes.error) console.error("Feil ved henting av lokasjoner:", locationsRes.error);

    setZones((zonesRes.data as Zone[]) ?? []);
    setLocations((locationsRes.data as LocationRow[]) ?? []);
    setLoading(false);
  }

  async function handleCreateLocation() {
    const code = newCode.trim().toUpperCase();
    if (!code) return;

    const { error } = await supabase.from("locations").insert({
      code,
      zone_id: newZoneId || null,
      active: newActive,
    });

    if (error) {
      console.error("Feil ved oppretting av lokasjon:", error);
      return;
    }

    setNewCode("");
    setNewZoneId("");
    setNewActive(true);
    setShowCreateModal(false);
    loadAll();
  }

  async function handleToggleActive(location: LocationRow) {
    const { error } = await supabase
      .from("locations")
      .update({ active: !location.active })
      .eq("id", location.id);

    if (error) {
      console.error("Feil ved oppdatering av lokasjon:", error);
      return;
    }

    setLocations((current) =>
      current.map((item) =>
        item.id === location.id ? { ...item, active: !item.active } : item
      )
    );
  }

  const filteredLocations = useMemo(() => {
    const q = query.trim().toLowerCase();

    return locations.filter((location) => {
      const matchesQuery =
        !q ||
        location.code.toLowerCase().includes(q) ||
        location.zones?.code.toLowerCase().includes(q) ||
        location.zones?.name.toLowerCase().includes(q);

      const matchesZone =
        selectedZone === "all" || location.zone_id === selectedZone;

      return matchesQuery && matchesZone;
    });
  }, [locations, query, selectedZone]);

  const activeCount = locations.filter((l) => l.active).length;
  const missingZoneCount = locations.filter((l) => !l.zone_id).length;
  const emptyLocationCount = locations.filter((l) => (l.inventory?.length ?? 0) === 0).length;

  return (
    <>
      <main className="min-h-screen bg-[#062f3b] text-white">
        <div className="mx-auto max-w-[1440px] px-6 py-8">
          <SnakeNav />

          <section className="overflow-hidden rounded-[32px] bg-white text-neutral-950 shadow-2xl shadow-black/30">
            <div className="grid gap-8 bg-gradient-to-br from-[#055a7d] to-[#042834] px-10 py-10 text-white lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">
                  SNAKE / Lokasjoner
                </p>
                <h1 className="mt-4 text-5xl font-semibold leading-[0.95] tracking-tight">
                  Lokasjoner
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
                  Opprett, filtrer og vedlikehold lagerplasser. Lokasjoner er
                  grunnmuren før plukklister og Shopify-flyt kobles på.
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex w-fit items-center gap-2 rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                Ny lokasjon
              </button>
            </div>

            <div className="grid gap-4 bg-[#f6f7f8] px-8 py-6 md:grid-cols-4">
              <StatCard icon={<Layers />} label="Totale" value={locations.length} tone="blue" />
              <StatCard icon={<CheckCircle2 />} label="Aktive" value={activeCount} tone="ok" />
              <StatCard icon={<AlertTriangle />} label="Uten sone" value={missingZoneCount} tone="gold" />
              <StatCard icon={<MapPin />} label="Tomme" value={emptyLocationCount} tone="neutral" />
            </div>

            <div className="border-t border-neutral-200 bg-white px-8 py-7">
              <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_280px_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="location-search"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Søk etter lokasjon, sone eller navn"
                    className="w-full rounded-2xl border border-neutral-300 bg-white py-3.5 pl-12 pr-4 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-[#055a7d]"
                  />
                </div>

                <select
                  id="zone-filter"
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-[#055a7d]"
                >
                  <option value="all">Alle soner</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code} — {zone.name}
                    </option>
                  ))}
                </select>

                {(query || selectedZone !== "all") && (
                  <button
                    onClick={() => {
                      setQuery("");
                      setSelectedZone("all");
                    }}
                    className="rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                  >
                    Nullstill
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-5">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                      Lokasjonsliste
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      {loading
                        ? "Henter lokasjoner..."
                        : `${filteredLocations.length} av ${locations.length} lokasjoner vises`}
                    </p>
                  </div>

                  <Link
                    href="/products"
                    className="text-sm font-semibold text-[#055a7d] underline-offset-4 hover:underline"
                  >
                    Gå til produkter
                  </Link>
                </div>


                {/* Mobil / nettbrett */}
<div className="divide-y divide-neutral-100 lg:hidden">
  {loading ? (
    <MobileEmpty text="Laster lokasjoner..." />
  ) : filteredLocations.length === 0 ? (
    <MobileEmpty text="Ingen lokasjoner funnet." />
  ) : (
    filteredLocations.map((location) => (
      <MobileLocationCard
        key={location.id}
        location={location}
        onToggle={() => handleToggleActive(location)}
      />
    ))
  )}
</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-white text-left text-xs uppercase tracking-[0.14em] text-neutral-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Lokasjon</th>
                        <th className="px-5 py-4 font-semibold">Sone</th>
                        <th className="px-5 py-4 font-semibold">Produkter</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Handling</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <EmptyRow text="Laster lokasjoner..." />
                      ) : filteredLocations.length === 0 ? (
                        <EmptyRow text="Ingen lokasjoner funnet." />
                      ) : (
                        filteredLocations.map((location) => {
                          const productCount = location.inventory?.length ?? 0;

                          return (
                            <tr
                              key={location.id}
                              className="border-t border-neutral-100 transition hover:bg-[#055a7d]/[0.025]"
                            >
                              <td className="px-5 py-5 text-sm font-semibold text-neutral-950">
                                <span className="inline-flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-[#055a7d]" />
                                  {location.code}
                                </span>
                              </td>

                              <td className="px-5 py-5 text-sm">
                                {location.zones ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-lg border border-[#055a7d]/20 bg-[#055a7d]/5 px-2 py-1 text-xs font-semibold text-[#055a7d]">
                                      {location.zones.code}
                                    </span>
                                    <span className="text-neutral-500">
                                      {location.zones.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-semibold text-[#a77e05]">
                                    Mangler sone
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-5 text-sm text-neutral-700">
                                {productCount}
                              </td>

                              <td className="px-5 py-5 text-sm">
                                {location.active ? (
                                  <StatusPill text="Aktiv" tone="ok" />
                                ) : (
                                  <StatusPill text="Inaktiv" tone="neutral" />
                                )}
                              </td>

                              <td className="px-5 py-5 text-sm">
                                <button
                                  onClick={() => handleToggleActive(location)}
                                  className="font-semibold text-[#055a7d] underline-offset-4 hover:underline"
                                >
                                  {location.active ? "Deaktiver" : "Aktiver"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <SnakeFooter />
        </div>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
  <div className="w-full rounded-t-3xl bg-white p-6 text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
              Ny lokasjon
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Opprett lagerplass
            </h2>

            <div className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="new-location-code"
                  className="mb-2 block text-sm font-medium text-neutral-700"
                >
                  Lokasjonskode
                </label>
                <input
                  id="new-location-code"
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="f.eks. KP12-04-01-A1"
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-[#055a7d]"
                />
              </div>

              <div>
                <label
                  htmlFor="new-zone"
                  className="mb-2 block text-sm font-medium text-neutral-700"
                >
                  Sone
                </label>
                <select
                  id="new-zone"
                  value={newZoneId}
                  onChange={(e) => setNewZoneId(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-[#055a7d]"
                >
                  <option value="">Velg sone</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code} — {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={newActive}
                  onChange={(e) => setNewActive(e.target.checked)}
                  className="h-4 w-4 accent-[#055a7d]"
                />
                Aktiv lokasjon
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCode("");
                  setNewZoneId("");
                  setNewActive(true);
                }}
                className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Avbryt
              </button>

              <button
                onClick={handleCreateLocation}
                className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileLocationCard({
  location,
  onToggle,
}: {
  location: LocationRow;
  onToggle: () => void;
}) {
  const productCount = location.inventory?.length ?? 0;

  return (
    <article className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-base font-semibold text-neutral-950">
            <MapPin className="h-4 w-4 text-[#055a7d]" />
            {location.code}
          </p>

          <div className="mt-3">
            {location.zones ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-[#055a7d]/20 bg-[#055a7d]/5 px-2 py-1 text-xs font-semibold text-[#055a7d]">
                  {location.zones.code}
                </span>
                <span className="text-sm text-neutral-500">
                  {location.zones.name}
                </span>
              </div>
            ) : (
              <span className="font-semibold text-[#a77e05]">
                Mangler sone
              </span>
            )}
          </div>
        </div>

        {location.active ? (
          <StatusPill text="Aktiv" tone="ok" />
        ) : (
          <StatusPill text="Inaktiv" tone="neutral" />
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-500">Produkter</span>
          <span className="text-base font-semibold text-neutral-950">
            {productCount}
          </span>
        </div>
      </div>

      <button
        onClick={onToggle}
        className="mt-4 w-full rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white"
      >
        {location.active ? "Deaktiver lokasjon" : "Aktiver lokasjon"}
      </button>
    </article>
  );
}

function MobileEmpty({ text }: { text: string }) {
  return <div className="px-5 py-10 text-sm text-neutral-500">{text}</div>;
}
function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={5} className="px-5 py-12 text-sm text-neutral-500">
        {text}
      </td>
    </tr>
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
  tone: "blue" | "gold" | "ok" | "neutral";
}) {
  const styles = {
    blue: "border-t-[#055a7d] text-[#055a7d]",
    gold: "border-t-[#a77e05] text-[#a77e05]",
    ok: "border-t-emerald-500 text-emerald-600",
    neutral: "border-t-neutral-300 text-neutral-500",
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

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: "ok" | "neutral";
}) {
  const styles = {
    ok: "border-green-200 bg-green-50 text-green-700",
    neutral: "border-neutral-200 bg-neutral-100 text-neutral-600",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {text}
    </span>
  );
}