"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  SkipForward,
} from "lucide-react";
import { LagerHero } from "../components/lager/LagerHero";
import { supabase } from "@/lib/supabase";
import { Progress } from "../components/design-system";

 const ASSIGN_ENDPOINT = "/api/inventory/set-location";

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
};

type ProductQueueItem = {
  productId: string;
  inventoryId: string;
  sku: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
  zoneId: string | null;
  zoneCode: string | null;
  zoneName: string | null;
};

export default function FixLocationsPage() {
  const [products, setProducts] = useState<ProductQueueItem[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [initialCount, setInitialCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const [skipReason, setSkipReason] = useState<
  "not_found" | "wrong_zone" | "needs_check" | "no_location" | "other"
>("needs_check");

const [skipNote, setSkipNote] = useState("");
const [skipOpen, setSkipOpen] = useState(false);

  const current = products[0] ?? null;

  const filteredLocations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return locations.filter((location) => {
  const hasZoneLinkedLocations = locations.some(
    (l) => l.zone_id === current?.zoneId
  );

  const matchesZone = hasZoneLinkedLocations
    ? location.zone_id === current?.zoneId
    : true;

  const matchesSearch =
    !term ||
    location.code.toLowerCase().includes(term) ||
    location.zones?.code.toLowerCase().includes(term) ||
    location.zones?.name.toLowerCase().includes(term);

  return matchesZone && matchesSearch;
});
  }, [locations, search, current]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedLocationId("");
    setSearch("");
  }, [current?.inventoryId]);

  async function loadData() {
    setLoading(true);
    setMessage(null);

    const [productsResult, locationsResult] = await Promise.all([
      supabase
        .from("products")
        .select(
          `
          id,
          sku,
          product_name,
          variant_name,
          inventory (
            id,
            quantity,
            zone_id,
            location_id,
            zones (
              id,
              code,
              name
            )
          )
        `
        )
        .order("product_name", { ascending: true }),

      supabase
        .from("locations")
        .select(
          `
          id,
          code,
          active,
          zone_id,
          zones (
            id,
            code,
            name
          )
        `
        )
        .eq("active", true)
        .order("code", { ascending: true }),
    ]);

    if (productsResult.error) {
      console.error(productsResult.error);
      setMessage("Kunne ikke hente produkter.");
    }

    if (locationsResult.error) {
      console.error(locationsResult.error);
      setMessage("Kunne ikke hente lokasjoner.");
    }

    const queue =
      productsResult.data
        ?.flatMap((product) =>
          (product.inventory ?? []).map((inventory) => ({
            productId: product.id,
            inventoryId: inventory.id,
            sku: product.sku,
            productName: product.product_name,
            variantName: product.variant_name,
            quantity: inventory.quantity ?? 0,
            zoneId: inventory.zone_id,
            zoneCode: (inventory.zones as any)?.code ?? null,
zoneName: (inventory.zones as any)?.name ?? null,
            locationId: inventory.location_id,
          }))
        )
        .filter((item) => item.zoneId && !item.locationId)
        .map(({ locationId, ...item }) => item) ?? [];
const locationRows =
    (locationsResult.data ?? []) as unknown as LocationRow[];
    setProducts(queue);
    setInitialCount(queue.length);
    setCompletedCount(0);
    setSkippedCount(0);
    setLocations(locationRows);
    setLoading(false);
  }

  async function handleAssign() {
    if (!current || !selectedLocationId) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(ASSIGN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: current.productId,
          inventoryId: current.inventoryId,
          locationId: selectedLocationId,
          quantity: current.quantity,
        }),
      });

      const text = await res.text();

let json: { error?: string } = {};

try {
  json = text ? JSON.parse(text) : {};
} catch {
  throw new Error(`API svarte ikke med JSON. Status: ${res.status}`);
}

if (!res.ok) {
  throw new Error(json.error ?? "Kunne ikke sette lokasjon");
}

      setProducts((prev) => prev.slice(1));
      setCompletedCount((prev) => prev + 1);
      setMessage("Lokasjon satt. Neste produkt klart.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setSaving(false);
    }
  }

 async function handleSkip() {
  if (!current) return;

  setSaving(true);
  setMessage(null);

  try {
    const res = await fetch("/api/fix-locations/skip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: current.productId,
        inventoryId: current.inventoryId,
        reason: skipReason,
        note: skipNote.trim() || null,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error ?? "Kunne ikke hoppe over");
    }

    setProducts((prev) => {
      if (prev.length <= 1) return prev;

      const [first, ...rest] = prev;

      return [...rest, first];
    });

    setSkippedCount((prev) => prev + 1);

    setSkipOpen(false);
    setSkipNote("");
    setSkipReason("needs_check");

    setMessage("Produkt hoppet over og logget.");
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Kunne ikke hoppe over"
    );
  } finally {
    setSaving(false);
  }
}

  return (
    <>
        <section className="overflow-hidden rounded-snake-panel bg-snake-workspace text-snake-text-primary shadow-snake-overlay">
          <LagerHero
  eyebrow="Snake / Ryddemodus"
  title="Sett eksakte lokasjoner"
  description="Én vare om gangen. Velg riktig lokasjon, lagre, og gå videre. Dette er Snake sin fokuserte arbeidsflyt for produkter som har sone, men mangler fast plassering."
  backHref="/lager"
  backLabel="Tilbake"
  right={
    <div className="grid grid-cols-3 overflow-hidden rounded-snake-card border border-snake-border-on-dark-subtle bg-snake-app-deep/10">
      <MiniStat label="i kø" value={products.length} />
      <MiniStat label="fikset" value={completedCount} />
      <MiniStat label="hoppet" value={skippedCount} />
    </div>
  }
>
  <Progress
    className="max-w-xl [&>div:first-child]:text-snake-text-on-dark-muted [&_[role=progressbar]]:bg-snake-app-elevated"
    label="Fremdrift"
    max={initialCount}
    showValue
    tone="warning"
    value={completedCount + skippedCount}
  />
</LagerHero>



          <div className="grid gap-5 px-5 py-7 sm:px-8 sm:py-8 lg:grid-cols-[1fr_420px]">
            <section className="rounded-snake-card border border-snake-border-subtle bg-snake-surface p-5 shadow-snake-card">
              {loading ? (
                <EmptyState
                  icon={<Loader2 className="h-8 w-8 animate-spin" />}
                  title="Henter kø"
                  text="Snake finner produkter som mangler eksakt lokasjon."
                />
              ) : !current ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-8 w-8 text-snake-success" />}
                  title="Alt ser ryddig ut"
                  text="Ingen produkter med sone mangler eksakt lokasjon akkurat nå."
                />
              ) : (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-snake-link/70">
                        Problem {completedCount + skippedCount + 1} av{" "}
                        {initialCount}
                      </p>

                     <h2 className="mt-2 line-clamp-2 min-h-[72px] text-3xl font-semibold tracking-tight text-snake-text-primary">
  {current.productName}
</h2>

                      {current.variantName && (
                        <p className="mt-1 text-sm text-snake-text-muted">
                          {current.variantName}
                        </p>
                      )}
                    </div>

                    <div className="rounded-snake-action border border-snake-warning-border bg-snake-warning-surface px-4 py-3 text-sm font-semibold text-snake-warning">
                      Mangler eksakt lokasjon
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <InfoBox label="SKU" value={current.sku ?? "Ingen SKU"} />
                    <InfoBox
                      label="Sone"
                      value={
                        current.zoneCode
                          ? `${current.zoneCode} — ${current.zoneName ?? ""}`
                          : "Ukjent"
                      }
                    />
                    <InfoBox label="Antall" value={String(current.quantity)} />
                  </div>

                  <div className="mt-7 rounded-snake-card border border-snake-border-subtle bg-snake-surface-subtle p-5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-snake-text-muted">
                      Finn lokasjon
                    </label>

                    <div className="relative mt-2">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-snake-text-disabled" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Søk etter lokasjonskode..."
                        className="w-full rounded-snake-action border border-snake-border-subtle bg-snake-surface py-3 pl-11 pr-4 text-sm text-snake-text-primary outline-none transition focus:border-snake-primary"
                      />
                    </div>

                    <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                      {filteredLocations.length === 0 ? (
                        <p className="rounded-snake-action border border-dashed border-snake-border-default bg-snake-surface p-4 text-sm text-snake-text-muted">
                          Ingen lokasjoner matcher.
                        </p>
                      ) : (
                        filteredLocations.map((location) => (
                          <button
                            key={location.id}
                            type="button"
                            onClick={() => setSelectedLocationId(location.id)}
                            className={[
                              "flex w-full items-center justify-between gap-3 rounded-snake-action border px-4 py-3 text-left transition",
                              selectedLocationId === location.id
                                ? "border-snake-primary bg-snake-primary/10"
                                : "border-snake-border-subtle bg-snake-surface hover:border-snake-primary/40",
                            ].join(" ")}
                          >
                            <span>
                              <span className="block text-sm font-semibold text-snake-text-primary">
                                {location.code}
                              </span>
                              <span className="mt-0.5 block text-xs text-snake-text-muted">
                                {location.zones?.code ?? "Uten sone"}{" "}
                                {location.zones?.name
                                  ? `— ${location.zones.name}`
                                  : ""}
                              </span>
                            </span>

                            <MapPin className="h-4 w-4 text-snake-text-disabled" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {message && (
                    <div className="mt-4 rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle px-4 py-3 text-sm text-snake-text-secondary">
                      {message}
                    </div>
                  )}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={!selectedLocationId || saving}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-snake-action bg-snake-primary px-5 py-3 text-sm font-semibold text-snake-text-on-dark transition hover:bg-snake-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Sett lokasjon
                    </button>

                    <button
                      type="button"
                      onClick={() => setSkipOpen(true)}
                      disabled={saving || products.length <= 1}
                      className="inline-flex items-center justify-center gap-2 rounded-snake-action border border-snake-border-subtle bg-snake-surface px-5 py-3 text-sm font-semibold text-snake-text-secondary transition hover:border-snake-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <SkipForward className="h-4 w-4" />
                      Hopp over
                    </button>
                  </div>
                </>
              )}
            </section>

            <aside className="space-y-5">
              <section className="rounded-snake-card border border-snake-border-subtle bg-snake-surface p-5 shadow-md">
  <p className="text-xs font-black uppercase tracking-[0.22em] text-snake-brand">
    Børre / Snake Intelligence
  </p>

  <h2 className="mt-3 text-2xl font-black text-snake-text-primary">
    Børre følger køen
  </h2>

  <p className="mt-3 text-sm leading-6 text-snake-text-secondary">
    Denne siden viser produkter som allerede har sone, men mangler eksakt lokasjon.
  </p>

  <div className="mt-5 rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle p-4">
    <p className="text-sm font-semibold text-snake-text-primary">
      Børre anbefaler:
    </p>

    <p className="mt-2 text-sm leading-6 text-snake-text-secondary">
      Velg riktig lokasjon, lagre, og gå videre. Hopp over hvis du er usikker.
      Produktet legger seg bakerst i køen.
    </p>
  </div>
</section>

              <section className="rounded-snake-card border border-snake-border-subtle bg-snake-surface p-5 shadow-snake-card">
                <h2 className="text-lg font-semibold text-snake-text-primary">
                  Hurtigvalg
                </h2>

                <div className="mt-4 grid gap-2">
                  <SideLink href="/products" label="Alle produkter" />
                  <SideLink href="/products?status=missing" label="Mangler plassering" />
                  <SideLink href="/products?status=diff" label="Quantity diff" />
                  <SideLink href="/locations" label="Lokasjoner" />
                </div>
              </section>

              <button
                type="button"
                onClick={loadData}
                className="inline-flex w-full items-center justify-center gap-2 rounded-snake-action border border-snake-border-subtle bg-snake-surface px-5 py-3 text-sm font-semibold text-snake-text-secondary transition hover:border-snake-primary/40"
              >
                <RotateCcw className="h-4 w-4" />
                Last kø på nytt
              </button>
            </aside>
          </div>
        </section>
{skipOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--snake-color-overlay)] p-4">
    <div className="w-full max-w-md rounded-snake-panel bg-snake-surface p-6 text-snake-text-primary shadow-2xl">
      <h2 className="text-2xl font-semibold tracking-tight">
        Hopp over produkt
      </h2>

      <p className="mt-2 text-sm text-snake-text-muted">
        Hvorfor hoppes dette produktet over?
      </p>

      <div className="mt-5 space-y-2">
        {[
          ["needs_check", "Må sjekkes"],
          ["not_found", "Ikke funnet fysisk"],
          ["wrong_zone", "Feil sone"],
          ["no_location", "Ingen egnet lokasjon"],
          ["other", "Annet"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              setSkipReason(value as typeof skipReason)
            }
            className={`w-full rounded-snake-action border px-4 py-3 text-left text-sm font-medium transition ${
              skipReason === value
                ? "border-snake-primary bg-snake-primary/10 text-snake-link"
                : "border-snake-border-subtle hover:border-snake-primary/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <textarea
        value={skipNote}
        onChange={(event) => setSkipNote(event.target.value)}
        placeholder="Notat, valgfritt"
        className="mt-4 min-h-[100px] w-full rounded-snake-action border border-snake-border-subtle px-4 py-3 text-sm outline-none transition focus:border-snake-primary"
      />

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSkipOpen(false)}
          className="rounded-snake-action border border-snake-border-subtle px-4 py-3 text-sm font-semibold"
        >
          Avbryt
        </button>

        <button
          type="button"
          onClick={handleSkip}
          disabled={saving}
          className="rounded-snake-action bg-snake-primary px-4 py-3 text-sm font-semibold text-snake-text-on-dark disabled:opacity-50"
        >
          {saving ? "Lagrer..." : "Hopp over"}
        </button>
      </div>
    </div>
  </div>
)}
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-snake-border-on-dark-subtle px-4 py-4 last:border-r-0">
      <p className="text-3xl font-semibold tracking-tight text-snake-text-on-dark">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-snake-text-on-dark-muted">
        {label}
      </p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-snake-text-disabled">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-snake-text-primary">
        {value}
      </p>
    </div>
  );
}

function SideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle px-4 py-3 text-sm font-semibold text-snake-text-secondary transition hover:border-snake-primary/40 hover:bg-snake-primary/5"
    >
      {label}
      <ArrowRight className="h-4 w-4 text-snake-text-disabled" />
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center rounded-snake-card border border-dashed border-snake-border-default bg-snake-surface-subtle p-8 text-center">
      <div className="text-snake-text-disabled">{icon}</div>
      <h2 className="mt-4 text-xl font-semibold text-snake-text-primary">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-snake-text-muted">
        {text}
      </p>
    </div>
  );
}
