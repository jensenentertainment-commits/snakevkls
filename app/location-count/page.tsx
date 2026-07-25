"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";
import { LagerHero } from "../components/lager/LagerHero";
import { supabase } from "@/lib/supabase";

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
    <>
        <section className="overflow-hidden rounded-snake-panel bg-snake-workspace text-snake-text-primary shadow-snake-overlay">
          <LagerHero
  eyebrow="Snake / Lokasjonstelling"
  title="Tell lokasjon"
  description="Velg en lokasjon, tell fysisk antall, og lagre avviket som kontrollhistorikk. V1 endrer ikke lagerantall automatisk."
  backHref="/"
  backLabel="Tilbake til dashboard"
/>

          <div className="grid gap-5 px-5 py-7 sm:px-8 sm:py-8 lg:grid-cols-[380px_1fr]">
            <aside className="rounded-snake-card border border-snake-border-subtle bg-snake-surface p-5 shadow-snake-card">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-snake-action border border-snake-primary/15 bg-snake-primary/10 text-snake-link">
                  <MapPin className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-snake-text-primary">
                    Velg lokasjon
                  </h2>
                  <p className="text-sm text-snake-text-muted">
                    Søk etter kode eller sone.
                  </p>
                </div>
              </div>

              <div className="relative mt-5">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-snake-text-disabled" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Søk lokasjon..."
                  className="w-full rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle py-3 pl-11 pr-4 text-sm text-snake-text-primary outline-none transition focus:border-snake-primary"
                />
              </div>

              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {loading ? (
                  <p className="rounded-snake-action border border-dashed border-snake-border-default bg-snake-surface-subtle p-4 text-sm text-snake-text-muted">
                    Henter lokasjoner...
                  </p>
                ) : filteredLocations.length === 0 ? (
                  <p className="rounded-snake-action border border-dashed border-snake-border-default bg-snake-surface-subtle p-4 text-sm text-snake-text-muted">
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
                        "w-full rounded-snake-action border px-4 py-3 text-left transition",
                        selectedLocationId === location.id
                          ? "border-snake-primary bg-snake-primary/10"
                          : "border-snake-border-subtle bg-snake-surface-subtle hover:border-snake-primary/40",
                      ].join(" ")}
                    >
                      <span className="block text-sm font-semibold text-snake-text-primary">
                        {location.code}
                      </span>
                      <span className="mt-0.5 block text-xs text-snake-text-muted">
                        {location.zones?.code ?? "Uten sone"}
                        {location.zones?.name ? ` — ${location.zones.name}` : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <section className="rounded-snake-card border border-snake-border-subtle bg-snake-surface p-5 shadow-snake-card">
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
      <div className="mb-5 rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-snake-brand">
          Børre / Lokasjonstelling
        </p>

        <p className="mt-2 text-sm leading-6 text-snake-text-secondary">
          {remaining > 0
            ? `Børre følger tellingen. ${remaining} lagerlinjer gjenstår på ${selectedLocation.code}.`
            : `Alle linjer på ${selectedLocation.code} er telt. Børre noterer kontrollert fremgang.`}
        </p>
      </div>

    return (
      <div
        className={`rounded-snake-card border px-5 py-4 ${
          progress.complete
            ? progress.hasDiffs
              ? "border-snake-warning-border bg-snake-warning-surface"
              : "border-snake-success-border bg-snake-success-surface"
            : "border-snake-border-subtle bg-snake-surface-subtle"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-snake-text-primary">
              {progress.counted} / {progress.total} linjer telt
            </p>

            <p className="mt-1 text-sm text-snake-text-secondary">
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
                  ? "bg-snake-warning-surface text-snake-warning"
                  : "bg-snake-success-surface text-snake-success"
                : "bg-snake-neutral-surface text-snake-text-secondary"
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
    className="rounded-full bg-snake-primary px-4 py-2 text-xs font-bold text-snake-text-on-dark transition hover:bg-snake-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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
        className={`rounded-snake-card border p-4 transition ${
          !status
            ? "border-snake-border-subtle bg-snake-surface-subtle"
            : status.diff === 0
              ? "border-snake-success-border bg-snake-success-surface"
              : Math.abs(status.diff) >= 5
                ? "border-snake-danger-border bg-snake-danger-surface"
                : "border-snake-warning-border bg-snake-warning-surface"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-snake-text-disabled">
              {line.products?.sku ?? "Ingen SKU"}
            </p>

            <h3 className="mt-1 text-lg font-semibold text-snake-text-primary">
              {line.products?.product_name ?? "Ukjent produkt"}
            </h3>

            {line.products?.variant_name && (
              <p className="mt-1 text-sm text-snake-text-muted">
                {line.products.variant_name}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-snake-text-secondary">
              <span>
                Forventet:{" "}
                <span className="font-semibold text-snake-text-primary">
                  {line.quantity}
                </span>
              </span>

              {status && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    status.diff === 0
                      ? "bg-snake-success-surface text-snake-success"
                      : Math.abs(status.diff) >= 5
                        ? "bg-snake-danger-surface text-snake-danger"
                        : "bg-snake-warning-surface text-snake-warning"
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
              className="rounded-snake-action border border-snake-border-subtle bg-snake-surface px-4 py-3 text-sm text-snake-text-primary outline-none transition focus:border-snake-primary"
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
              className="rounded-snake-action border border-snake-border-subtle bg-snake-surface px-4 py-3 text-sm text-snake-text-primary outline-none transition focus:border-snake-primary"
            />

            <button
              type="button"
              onClick={() => saveCount(line)}
              disabled={savingId === line.id}
              className="inline-flex items-center justify-center gap-2 rounded-snake-action bg-snake-primary px-4 py-3 text-sm font-semibold text-snake-text-on-dark transition hover:bg-snake-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="mt-4 rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle px-4 py-3 text-sm text-snake-text-secondary">
      {message}
    </div>
  )}
</section>
          </div>
        </section>

    </>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-snake-card border border-dashed border-snake-border-default bg-snake-surface-subtle p-8 text-center">
      <ClipboardCheck className="h-9 w-9 text-snake-text-disabled" />
      <h2 className="mt-4 text-xl font-semibold text-snake-text-primary">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-snake-text-muted">
        {text}
      </p>
    </div>
  );
}
