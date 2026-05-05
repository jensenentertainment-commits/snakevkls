"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  MapPin,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";

type ProductRow = {
  id: string;
  sku: string | null;
  product_name: string;
  variant_name: string | null;
  inventory: {
  id: string;
  quantity: number;
  location_id: string | null;
  zone_id: string | null;
  zones: {
    code: string;
    name: string;
  } | null;
}[];
};

type LocationRow = {
  id: string;
  code: string;
  active: boolean;
  zone_id: string | null;
};

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#003b46] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />
      </div>

      {children}

      <SnakeFooter />
    </main>
  );
}
export default function FixLocationsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [index, setIndex] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const current = products[index];
  const currentInventory = current?.inventory?.[0];
const hasZone = currentInventory?.zone_id;
const currentZone = zones.find((zone) => zone.id === currentInventory?.zone_id);
const currentZoneLabel = currentZone
  ? `${currentZone.code} — ${currentZone.name}`
  : null;
  const totalCount = products.length;
  const doneCount = 0;
  const progress =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;

  const activeLocations = useMemo(() => {
  if (!current) return [];

  const zoneId = currentInventory?.zone_id;

  return locations
    .filter((loc) => loc.active)
    .filter((loc) => (zoneId ? loc.zone_id === zoneId : true))
    .sort((a, b) => a.code.localeCompare(b.code));
}, [locations, current]);

  async function loadData() {
    setLoading(true);

    const [
      { data: productData, error: productError },
      { data: locationData, error: locationError },
      { data: zoneData, error: zoneError },
    ] = await Promise.all([
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
            location_id,
            zone_id
          )
        `
        )
        .order("product_name", { ascending: true }),

      supabase
        .from("locations")
        .select("id, code, active, zone_id")
        .eq("active", true)
        .order("code", { ascending: true }),

        supabase
  .from("zones")
  .select("id, code, name")
  .eq("active", true)
  .order("code", { ascending: true }),
    ]);



    if (productError) console.error(productError);
    if (locationError) console.error(locationError);
    if (zoneError) console.error(zoneError);

    
   const missingLocationProducts =
  productData?.filter((product) => {
    const inventory = product.inventory?.[0];

    return inventory?.zone_id && !inventory.location_id;
  }) ?? [];

    setProducts(missingLocationProducts as ProductRow[]);
    setLocations((locationData ?? []) as LocationRow[]);
    setZones((zoneData ?? []) as ZoneRow[]);
    setIndex(0);
    setSelectedLocationId("");
    setTimeout(() => {
  document.getElementById("location-select")?.focus();
}, 50);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  

  type ZoneRow = {
  id: string;
  code: string;
  name: string;
};

useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Enter") return;

    if (event.shiftKey) {
      event.preventDefault();
      skipCurrent();
      return;
    }

    if (selectedLocationId && !saving) {
      event.preventDefault();
      handleAssign();
    }
  }

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [selectedLocationId, saving, current?.id]);

  async function handleAssign() {
    if (!current || !selectedLocationId) return;

    setSaving(true);

    const { error } = currentInventory
  ? await supabase
      .from("inventory")
      .update({ location_id: selectedLocationId })
      .eq("id", currentInventory.id)
  : await supabase.from("inventory").insert({
      product_id: current.id,
      location_id: selectedLocationId,
      quantity: 0,
      is_primary: true,
    });

    if (error) {
      console.error(error);
      setSaving(false);
      return;
    }

    setSelectedLocationId("");

    if (index + 1 >= products.length) {
      setProducts([]);
      setIndex(0);
    } else {
     setProducts((prev) => {
  const [first, ...rest] = prev;
  return [...rest, first];
  });
    }

    setSaving(false);
    document.body.classList.add("flash-success");
setTimeout(() => {
  document.body.classList.remove("flash-success");
}, 120);
  }

  function skipCurrent() {
  setSelectedLocationId("");

  setProducts((prev) => {
    if (prev.length <= 1) return prev;

    const [currentProduct, ...rest] = prev;
    return [...rest, currentProduct];
  });

  setIndex(0);
}

if (loading) {
    return (
      <PageShell>
        <section className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-5 shadow-2xl">
            <div className="flex items-center gap-3 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
              Henter produkter uten lokasjon…
            </div>
          </div>
        </section>
      </PageShell>
    );
  }

  if (!current) {
    return (
      <PageShell>
        <section className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-5">
          <div className="w-full max-w-xl rounded-[2rem] border border-emerald-400/15 bg-emerald-400/[0.04] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
              <Check className="h-7 w-7" />
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/70">
              Ryddemodus fullført
            </p>

            <h1 className="text-2xl font-semibold">
              Alle produkter har lokasjon
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/55">
              Køen er tom. Lageret er ryddigere enn det later som. Foreløpig.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/products"
                className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10"
              >
                Til produkter
              </Link>

              <button
                onClick={loadData}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-300"
              >
                <RotateCcw className="h-4 w-4" />
                Sjekk igjen
              </button>
            </div>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
  <PageShell>
    <section className="mx-auto max-w-[1200px] px-6 pb-16 pt-3">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#003b46] shadow-2xl">
        <div className="grid gap-8 bg-[#05586b] px-9 py-9 lg:grid-cols-[1fr_420px]">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-white/55">
              Snake / Ryddemodus
            </p>
<h1 className="text-4xl font-black tracking-tight text-white">
              Rydd lokasjoner
            </h1>

            <p className="mt-5 max-w-2xl text-base text-white/80">
              Ett produkt av gangen. Sett lokasjon, så går Snake automatisk videre
              til neste vare i køen.
            </p>
          </div>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
              Fremdrift
            </div>

            <div className="rounded-2xl bg-white/10 p-5">
              <div className="mb-3 flex justify-between text-sm text-white/75">
                <span>Produkt {index + 1} av {totalCount}</span>
                <span>{progress}% ferdig</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-black/25">
                <div
                  className="h-full rounded-full bg-[#d4a72c] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#00313a] px-10 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/issues"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Til avvik
            </Link>

            <div className="rounded-xl bg-[#d4a72c] px-4 py-2 text-sm font-bold text-black">
              Ryddemodus
            </div>
          </div>
        </div>

        <div className="bg-white px-6 py-6 text-[#111]">
          <section className="rounded-2xl border border-black/10 bg-white shadow-sm">
            <div className="border-b border-black/10 p-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-100">
                <MapPin className="h-3.5 w-3.5" />
                Mangler lokasjon
              </div>

              <h2 className="text-2xl font-black leading-tight">
                {current.product_name}
              </h2>

              {current.variant_name && (
                <p className="mt-2 text-sm text-black/60">
                  {current.variant_name}
                </p>
              )}
            </div>

            <div className="grid gap-4 border-b border-black/10 p-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f6f6f6] p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-black/45">
                  SKU
                </div>
                <div className="mt-1 font-black">
                  {current.sku || "Mangler SKU"}
                </div>
              </div>

              <div className="rounded-2xl bg-[#f6f6f6] p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-black/45">
                  Antall
                </div>
                <div className="mt-1 font-black">
                  {currentInventory?.quantity ?? 0}
                </div>
              </div>

              <div className="rounded-2xl bg-red-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-red-400">
                  Status
                </div>
                <div className="mt-1 font-black text-red-600">Uplassert</div>
              </div>
            </div>

            <div className="p-6">
              <label>
  {hasZone ? "Velg lokasjon" : "Velg sone først"}
</label>
{hasZone && (
  <div className="mb-3 text-sm text-black/60">
    Sone:{" "}
<span className="font-semibold">
  {currentZoneLabel ?? "Ukjent sone"}
</span>
  </div>
)}

              <select
  id="location-select"
  disabled={!hasZone}
  value={selectedLocationId}
                onChange={(event) => setSelectedLocationId(event.target.value)}
               className="w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-black outline-none focus:border-[#d4a72c] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                <option value="">Velg lokasjon…</option>

                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code}
                  </option>
                ))}
              </select>

{!hasZone && (
  <p className="mt-2 text-sm font-semibold text-[#a77e05]">
    Produktet må ha sone før nøyaktig lokasjon kan settes.
  </p>
)}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  onClick={skipCurrent}
                  disabled={saving}
                  className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-bold text-black/60 hover:bg-black/[0.04] disabled:opacity-40"
                >
                  Hopp over
                </button>

                <button
                  onClick={handleAssign}
                  disabled={!selectedLocationId || saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d4a72c] px-6 py-3 text-sm font-black text-black hover:bg-[#c99b22] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Lagrer
                    </>
                  ) : (
                    <>
                      Sett lokasjon og neste
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  </PageShell>
);
}
