"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Layers,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  SkipForward,
} from "lucide-react";
import SnakeHero from "../components/SnakeHero";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";

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

  const progress =
    initialCount > 0
      ? Math.round(((completedCount + skippedCount) / initialCount) * 100)
      : 0;

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

  function handleSkip() {
    setProducts((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev;
      return [...rest, first];
    });

    setSkippedCount((prev) => prev + 1);
    setMessage("Hoppet over. Produktet ligger bakerst i køen.");
  }

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <section className="overflow-hidden rounded-[28px] bg-[#e8eef0] text-neutral-950 shadow-2xl shadow-black/30">
          <SnakeHero
  eyebrow="Snake / Ryddemodus"
  title="Sett eksakte lokasjoner"
  description="Én vare om gangen. Velg riktig lokasjon, lagre, og gå videre. Dette er Snake sin fokuserte arbeidsflyt for produkter som har sone, men mangler fast plassering."
  backHref="/"
  backLabel="Tilbake til dashboard"
  right={
    <div className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/10 bg-black/10">
      <MiniStat label="i kø" value={products.length} />
      <MiniStat label="fikset" value={completedCount} />
      <MiniStat label="hoppet" value={skippedCount} />
    </div>
  }
>
  <div className="max-w-xl">
    <div className="mb-2 flex items-center justify-between text-xs text-white/50">
      <span>Fremdrift</span>

      <span>
        {completedCount + skippedCount} / {initialCount}
      </span>
    </div>

    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-[#b58a14] transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
</SnakeHero>

          <div className="grid gap-5 px-5 py-7 sm:px-8 sm:py-8 lg:grid-cols-[1fr_420px]">
            <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              {loading ? (
                <EmptyState
                  icon={<Loader2 className="h-8 w-8 animate-spin" />}
                  title="Henter kø"
                  text="Snake finner produkter som mangler eksakt lokasjon."
                />
              ) : !current ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-8 w-8 text-emerald-600" />}
                  title="Alt ser ryddig ut"
                  text="Ingen produkter med sone mangler eksakt lokasjon akkurat nå."
                />
              ) : (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#055a7d]/70">
                        Problem {completedCount + skippedCount + 1} av{" "}
                        {initialCount}
                      </p>

                     <h2 className="mt-2 line-clamp-2 min-h-[72px] text-3xl font-semibold tracking-tight text-neutral-950">
  {current.productName}
</h2>

                      {current.variantName && (
                        <p className="mt-1 text-sm text-neutral-500">
                          {current.variantName}
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
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

                  <div className="mt-7 rounded-3xl border border-black/10 bg-neutral-50 p-5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Finn lokasjon
                    </label>

                    <div className="relative mt-2">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Søk etter lokasjonskode..."
                        className="w-full rounded-2xl border border-black/10 bg-white py-3 pl-11 pr-4 text-sm text-neutral-950 outline-none transition focus:border-[#055a7d]"
                      />
                    </div>

                    <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                      {filteredLocations.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-black/15 bg-white p-4 text-sm text-neutral-500">
                          Ingen lokasjoner matcher.
                        </p>
                      ) : (
                        filteredLocations.map((location) => (
                          <button
                            key={location.id}
                            type="button"
                            onClick={() => setSelectedLocationId(location.id)}
                            className={[
                              "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
                              selectedLocationId === location.id
                                ? "border-[#055a7d] bg-[#055a7d]/10"
                                : "border-black/10 bg-white hover:border-[#055a7d]/40",
                            ].join(" ")}
                          >
                            <span>
                              <span className="block text-sm font-semibold text-neutral-950">
                                {location.code}
                              </span>
                              <span className="mt-0.5 block text-xs text-neutral-500">
                                {location.zones?.code ?? "Uten sone"}{" "}
                                {location.zones?.name
                                  ? `— ${location.zones.name}`
                                  : ""}
                              </span>
                            </span>

                            <MapPin className="h-4 w-4 text-neutral-400" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {message && (
                    <div className="mt-4 rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                      {message}
                    </div>
                  )}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={!selectedLocationId || saving}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#055a7d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#044b68] disabled:cursor-not-allowed disabled:opacity-50"
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
                      onClick={handleSkip}
                      disabled={saving || products.length <= 1}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[#055a7d]/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <SkipForward className="h-4 w-4" />
                      Hopp over
                    </button>
                  </div>
                </>
              )}
            </section>

            <aside className="space-y-5">
              <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#055a7d]/15 bg-[#055a7d]/10 text-[#055a7d]">
                    <Layers className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-neutral-950">
                      Ryddemodus v2
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Fokusert kø. Mindre støy.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm leading-6 text-neutral-600">
                  <p>
                    Denne siden viser produkter som allerede har sone, men
                    mangler eksakt lokasjon.
                  </p>
                  <p>
                    Hopp over legger produktet bakerst i køen, slik at du kan
                    fortsette uten å stoppe flyten.
                  </p>
                </div>
              </section>

              <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-neutral-950">
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[#055a7d]/40"
              >
                <RotateCcw className="h-4 w-4" />
                Last kø på nytt
              </button>
            </aside>
          </div>
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-white/10 px-4 py-4 last:border-r-0">
      <p className="text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-neutral-950">
        {value}
      </p>
    </div>
  );
}

function SideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[#055a7d]/40 hover:bg-[#055a7d]/5"
    >
      {label}
      <ArrowRight className="h-4 w-4 text-neutral-400" />
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
    <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-black/15 bg-neutral-50 p-8 text-center">
      <div className="text-neutral-400">{icon}</div>
      <h2 className="mt-4 text-xl font-semibold text-neutral-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
        {text}
      </p>
    </div>
  );
}