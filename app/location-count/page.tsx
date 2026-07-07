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
const [completing, setCompleting] = useState(false);
  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null;
  const [completedLocationIds, setCompletedLocationIds] = useState<string[]>([]);
  const selectedLocationCompleted = selectedLocation
  ? completedLocationIds.includes(selectedLocation.id)
  : false;


  
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

  async function completeLocationCount() {
  if (!selectedLocation) return;

  const progress = getLocationProgress();

  if (!progress || !progress.complete) {
    setMessage("Alle linjer må telles før lokasjonen kan fullføres.");
    return;
  }

  setCompleting(true);
  setMessage(null);

  try {
    const res = await fetch("/api/location-count/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: selectedLocation.id,
        locationCode: selectedLocation.code,
        totalLines: progress.total,
        matchedLines: progress.matches,
        diffLines: progress.diffs,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error ?? "Kunne ikke fullføre telling");
    }

    setMessage("Lokasjonstelling fullført og logget.");
    setCompletedLocationIds((prev) =>
  prev.includes(selectedLocation.id) ? prev : [...prev, selectedLocation.id]
);
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Kunne ikke fullføre telling"
    );
  } finally {
    setCompleting(false);
  }
}

function getLineStatus(line: InventoryLine) {
  const raw = counts[line.id];

  if (raw === undefined || raw === "") {
    return null;
  }

  const counted = Number(raw);

  if (Number.isNaN(counted)) {
    return null;
  }

  const expected = line.quantity ?? 0;
  const diff = counted - expected;

  return {
    counted,
    expected,
    diff,
  };
}

function getLocationProgress() {
  if (!selectedLocation) return null;

  const total = selectedLocation.inventory.length;

  const counted = selectedLocation.inventory.filter((line) => {
    const raw = counts[line.id];

    return raw !== undefined && raw !== "";
  }).length;

  const diffs = selectedLocation.inventory.reduce(
    (acc, line) => {
      const status = getLineStatus(line);

      if (!status) return acc;

      if (status.diff === 0) {
        acc.match++;
      } else {
        acc.diff++;
      }

      return acc;
    },
    {
      match: 0,
      diff: 0,
    }
  );

  return {
    total,
    counted,
    complete: counted === total,
    hasDiffs: diffs.diff > 0,
    matches: diffs.match,
    diffs: diffs.diff,
  };
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
  text="Børre venter på en lokasjon før han begynner å mene noe."
/>
  ) : selectedLocation.inventory.length === 0 ? (
    <EmptyState
      title="Tom lokasjon"
      text="Denne lokasjonen har ingen lagerlinjer registrert."
    />
  ) : (
                <>
 {(() => {
  const progress = getLocationProgress();

  if (!progress) return null;

  const remaining = progress.total - progress.counted;

  return (
    <>
      <div className="mb-5 rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b58a14]">
          Børre / Lokasjonstelling
        </p>

        <p className="mt-2 text-sm leading-6 text-neutral-600">
          {remaining > 0
            ? `Børre følger tellingen. ${remaining} lagerlinjer gjenstår på ${selectedLocation.code}.`
            : `Alle linjer på ${selectedLocation.code} er telt. Børre noterer kontrollert fremgang.`}
        </p>
      </div>

    return (
      <div
        className={`rounded-3xl border px-5 py-4 ${
          progress.complete
            ? progress.hasDiffs
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
            : "border-black/10 bg-neutral-50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-950">
              {progress.counted} / {progress.total} linjer telt
            </p>

            <p className="mt-1 text-sm text-neutral-600">
              {progress.complete
                ? progress.hasDiffs
                  ? `${progress.diffs} avvik registrert`
                  : "Lokasjon ferdig telt uten avvik"
                : "Registrer telling for alle linjer"}
            </p>
          </div>

          <div
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
              progress.complete
                ? progress.hasDiffs
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
                : "bg-neutral-200 text-neutral-600"
            }`}
          >
            {selectedLocationCompleted
  ? "Fullført"
  : progress.complete
    ? progress.hasDiffs
      ? "Avvik funnet"
      : "Klar"
    : "Pågår"}

              {progress.complete && (
  <button
    type="button"
    onClick={completeLocationCount}
   disabled={completing || selectedLocationCompleted}
    className="rounded-full bg-[#055a7d] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#044b68] disabled:cursor-not-allowed disabled:opacity-50"
  >
    {selectedLocationCompleted
  ? "Fullført"
  : completing
    ? "Fullfører..."
    : "Fullfør telling"}
  </button>
)}
          </div>
        </div>
           </div>
    </>
  );
})()}


                  <div className="mt-6 space-y-3">
  {selectedLocation.inventory.map((line) => {
    const status = getLineStatus(line);

    return (
      <article
        key={line.id}
        className={`rounded-3xl border p-4 transition ${
          !status
            ? "border-black/10 bg-neutral-50"
            : status.diff === 0
              ? "border-emerald-200 bg-emerald-50"
              : Math.abs(status.diff) >= 5
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
        }`}
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

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              <span>
                Forventet:{" "}
                <span className="font-semibold text-neutral-950">
                  {line.quantity}
                </span>
              </span>

              {status && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    status.diff === 0
                      ? "bg-emerald-100 text-emerald-700"
                      : Math.abs(status.diff) >= 5
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {status.diff === 0
                    ? "Stemmer"
                    : status.diff > 0
                      ? `+${status.diff}`
                      : status.diff}
                </span>
              )}
            </div>
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
    );
  })}
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