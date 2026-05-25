"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";
import SnakeHero from "../components/SnakeHero";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";

type InventoryLine = {
  id: string;
  quantity: number;
  products: {
    id: string;
    sku: string | null;
    product_name: string;
    variant_name: string | null;
  } | null;
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
  inventory: InventoryLine[];
};

export default function LocationCountPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null;

  const filteredLocations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return locations.filter((location) => {
      if (!location.active) return false;

      return (
        !term ||
        location.code.toLowerCase().includes(term) ||
        location.zones?.code.toLowerCase().includes(term) ||
        location.zones?.name.toLowerCase().includes(term)
      );
    });
  }, [locations, search]);

  useEffect(() => {
    loadLocations();
  }, []);

  async function loadLocations() {
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase
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
          id,
          quantity,
          products (
            id,
            sku,
            product_name,
            variant_name
          )
        )
      `)
      .eq("active", true)
      .order("code", { ascending: true });

    if (error) {
      console.error(error);
      setMessage("Kunne ikke hente lokasjoner.");
      setLoading(false);
      return;
    }

    setLocations((data ?? []) as unknown as LocationRow[]);
    setLoading(false);
  }

  async function saveCount(line: InventoryLine) {
    if (!selectedLocation) return;

    const rawCount = counts[line.id];
    const countedQuantity = Number(rawCount);

    if (rawCount === undefined || rawCount === "") {
      setMessage("Mangler telt antall.");
      return;
    }

    if (Number.isNaN(countedQuantity) || countedQuantity < 0) {
      setMessage("Ugyldig antall.");
      return;
    }

    setSavingId(line.id);
    setMessage(null);

    try {
      const res = await fetch("/api/location-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: selectedLocation.id,
          inventoryId: line.id,
          expectedQuantity: line.quantity ?? 0,
          countedQuantity,
          note: notes[line.id] ?? null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Kunne ikke lagre telling");
      }

      setMessage("Telling lagret.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <section className="overflow-hidden rounded-[28px] bg-[#e8eef0] text-neutral-950 shadow-2xl shadow-black/30">
          <SnakeHero
  eyebrow="Snake / Lokasjonstelling"
  title="Tell lokasjon"
  description="Velg en lokasjon, tell fysisk antall, og lagre avviket som kontrollhistorikk. V1 endrer ikke lagerantall automatisk."
  backHref="/"
  backLabel="Tilbake til dashboard"
/>

          <div className="grid gap-5 px-5 py-7 sm:px-8 sm:py-8 lg:grid-cols-[380px_1fr]">
            <aside className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#055a7d]/15 bg-[#055a7d]/10 text-[#055a7d]">
                  <MapPin className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-neutral-950">
                    Velg lokasjon
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Søk etter kode eller sone.
                  </p>
                </div>
              </div>

              <div className="relative mt-5">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Søk lokasjon..."
                  className="w-full rounded-2xl border border-black/10 bg-neutral-50 py-3 pl-11 pr-4 text-sm text-neutral-950 outline-none transition focus:border-[#055a7d]"
                />
              </div>

              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {loading ? (
                  <p className="rounded-2xl border border-dashed border-black/15 bg-neutral-50 p-4 text-sm text-neutral-500">
                    Henter lokasjoner...
                  </p>
                ) : filteredLocations.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-black/15 bg-neutral-50 p-4 text-sm text-neutral-500">
                    Ingen lokasjoner funnet.
                  </p>
                ) : (
                  filteredLocations.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => {
                        setSelectedLocationId(location.id);
                        setCounts({});
                        setNotes({});
                        setMessage(null);
                      }}
                      className={[
                        "w-full rounded-2xl border px-4 py-3 text-left transition",
                        selectedLocationId === location.id
                          ? "border-[#055a7d] bg-[#055a7d]/10"
                          : "border-black/10 bg-neutral-50 hover:border-[#055a7d]/40",
                      ].join(" ")}
                    >
                      <span className="block text-sm font-semibold text-neutral-950">
                        {location.code}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {location.zones?.code ?? "Uten sone"}
                        {location.zones?.name ? ` — ${location.zones.name}` : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              {!selectedLocation ? (
                <EmptyState
                  title="Velg en lokasjon"
                  text="Snake viser forventet innhold når en lokasjon er valgt."
                />
              ) : selectedLocation.inventory.length === 0 ? (
                <EmptyState
                  title="Tom lokasjon"
                  text="Denne lokasjonen har ingen lagerlinjer registrert."
                />
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#055a7d]/70">
                        Aktiv telling
                      </p>
                      <h2 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950">
                        {selectedLocation.code}
                      </h2>
                      <p className="mt-1 text-sm text-neutral-500">
                        {selectedLocation.inventory.length} lagerlinjer forventet
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                      Teller kun — endrer ikke lager
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {selectedLocation.inventory.map((line) => (
                      <article
                        key={line.id}
                        className="rounded-3xl border border-black/10 bg-neutral-50 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                              {line.products?.sku ?? "Ingen SKU"}
                            </p>

                            <h3 className="mt-1 text-lg font-semibold text-neutral-950">
                              {line.products?.product_name ?? "Ukjent produkt"}
                            </h3>

                            {line.products?.variant_name && (
                              <p className="mt-1 text-sm text-neutral-500">
                                {line.products.variant_name}
                              </p>
                            )}

                            <p className="mt-3 text-sm text-neutral-600">
                              Forventet:{" "}
                              <span className="font-semibold text-neutral-950">
                                {line.quantity}
                              </span>
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto] lg:min-w-[520px]">
                            <input
                              type="number"
                              min="0"
                              value={counts[line.id] ?? ""}
                              onChange={(event) =>
                                setCounts((prev) => ({
                                  ...prev,
                                  [line.id]: event.target.value,
                                }))
                              }
                              placeholder="Telt"
                              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-[#055a7d]"
                            />

                            <input
                              value={notes[line.id] ?? ""}
                              onChange={(event) =>
                                setNotes((prev) => ({
                                  ...prev,
                                  [line.id]: event.target.value,
                                }))
                              }
                              placeholder="Notat, valgfritt"
                              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-[#055a7d]"
                            />

                            <button
                              type="button"
                              onClick={() => saveCount(line)}
                              disabled={savingId === line.id}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#044b68] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {savingId === line.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Lagre
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}

              {message && (
                <div className="mt-4 rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  {message}
                </div>
              )}
            </section>
          </div>
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-black/15 bg-neutral-50 p-8 text-center">
      <ClipboardCheck className="h-9 w-9 text-neutral-400" />
      <h2 className="mt-4 text-xl font-semibold text-neutral-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
        {text}
      </p>
    </div>
  );
}