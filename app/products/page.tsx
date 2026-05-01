"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";
import SnakeDropdown from "../components/SnakeDropdown";
import SnakeToolbar from "../components/SnakeToolbar";
import SnakeHero from "../components/SnakeHero";
import SnakeToast from "../components/SnakeToast";

const ZONE_STYLES: Record<string, string> = {
  HL: "border-blue-200 bg-blue-50 text-blue-700",
  SR: "border-purple-200 bg-purple-50 text-purple-700",
  SM: "border-green-200 bg-green-50 text-green-700",
  ME: "border-amber-200 bg-amber-50 text-amber-700",
};

type PlacementStatus = "location" | "zone" | "missing";

type ProductMeta = {
  quantity: number;
  locationCode: string | null;
  zoneLabel: string | null;
  zoneId: string | null;
  zoneCode: string | null;
  status: PlacementStatus;
};

type ProductRow = {
  id: string;
  sku: string | null;
  product_name: string;
  variant_name: string | null;
  image_url: string | null;
  vendor: string | null;
  product_type: string | null;
  shopify_quantity: number;
  product_collections: {
  id: string;
  title: string;
  handle: string | null;
}[];
  inventory: {
    id: string;
    quantity: number;
    zone_id: string | null;
    zones: {
      id: string;
      code: string;
      name: string;
    } | null;
    locations: {
      id: string;
      code: string;
      zone_id: string | null;
      zones: {
        id: string;
        code: string;
        name: string;
      } | null;
    } | null;
  }[];
};

type ZoneOption = {
  id: string;
  code: string;
  name: string;
};

type LocationOption = {
  id: string;
  code: string;
  zone_id: string | null;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
const [sortMode, setSortMode] = useState<"az" | "za">("az");
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [newZone, setNewZone] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newQuantity, setNewQuantity] = useState("0");

  const [selected, setSelected] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchZone, setBatchZone] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
const [toast, setToast] = useState<{
  message: string;
  tone: "success" | "error";
} | null>(null);
const [recentlyUpdated, setRecentlyUpdated] = useState(false);



  const [statusFilter, setStatusFilter] = useState<
    "all" | "missing" | "zone" | "location" | "diff"
  >("all");

  const [zoneFilter, setZoneFilter] = useState("all");
const [collectionFilter, setCollectionFilter] = useState("all");
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
  if (batchOpen) {
    setBatchZone("");
  }
}, [batchOpen]);
function showToast(message: string, tone: "success" | "error" = "success") {
  setToast({ message, tone });
  setTimeout(() => setToast(null), 3200);
}
  async function loadData() {
    setLoading(true);

    const [productsRes, locationsRes, zonesRes] = await Promise.all([
      supabase
        .from("products")
        .select(`
          id,
          sku,
          product_name,
          variant_name,
          image_url,
          vendor,
          product_type,
          shopify_quantity,
          product_collections (
  id,
  title,
  handle
),
          inventory (
            id,
            quantity,
            zone_id,
            zones (
              id,
              code,
              name
            ),
            locations (
              id,
              code,
              zone_id,
              zones (
                id,
                code,
                name
              )
            )
          )
        `)
        .eq("active", true)
        .order("product_name", { ascending: true }),

      supabase
        .from("locations")
        .select("id, code, zone_id")
        .eq("active", true)
        .order("code", { ascending: true }),

      supabase
        .from("zones")
        .select("id, code, name")
        .eq("active", true)
        .order("code", { ascending: true }),
    ]);

    if (productsRes.error) console.error(productsRes.error);
    if (locationsRes.error) console.error(locationsRes.error);
    if (zonesRes.error) console.error(zonesRes.error);

    setProducts((productsRes.data as unknown as ProductRow[]) ?? []);
    console.log("products sample", productsRes.data?.[0]);
    setLocations((locationsRes.data as LocationOption[]) ?? []);
    setZones((zonesRes.data as ZoneOption[]) ?? []);
    setLoading(false);
  }

 async function handleBatchSave() {
  if (!batchZone || selected.length === 0 || batchSaving) return;

  setBatchSaving(true);

  const selectedProducts = products.filter((product) =>
    selected.includes(product.id)
  );

  let updated = 0;

  for (const product of selectedProducts) {
    const existing = product.inventory?.[0];
    const quantity = existing?.quantity ?? product.shopify_quantity ?? 0;

    const payload = {
  zone_id: batchZone,
  quantity,
};

    const { error } = existing
      ? await supabase.from("inventory").update(payload).eq("id", existing.id)
      : await supabase.from("inventory").insert({
          product_id: product.id,
          ...payload,
          is_primary: true,
        });

    if (error) {
      setBatchSaving(false);
      showToast(`Kunne ikke batch-lagre: ${error.message}`, "error");
      return;
    }

    updated++;
  }

  setBatchOpen(false);
  setSelected([]);
  setBatchZone("");
  setBatchSaving(false);

const zoneName =
  zones.find((zone) => zone.id === batchZone)?.code ?? "valgt sone";

showToast(`${updated} produkter → ${zoneName}`);

await loadData();
window.scrollTo({ top: 0, behavior: "smooth" });
}

  async function handleSave() {
    if (!editing) return;

    const quantity = Number(newQuantity);

    if (Number.isNaN(quantity) || quantity < 0) {
      alert("Antall må være 0 eller høyere");
      return;
    }

    const selectedLocation = locations.find(
      (location) => location.id === newLocation
    );

    const zoneId = selectedLocation?.zone_id || newZone || null;

    if (!zoneId && !newLocation) {
      alert("Velg minst sone eller lokasjon");
      return;
    }

    const existing = editing.inventory?.[0];

    const payload = {
      location_id: newLocation || null,
      zone_id: zoneId,
      quantity,
    };

    const { error } = existing
      ? await supabase.from("inventory").update(payload).eq("id", existing.id)
      : await supabase.from("inventory").insert({
          product_id: editing.id,
          ...payload,
          is_primary: true,
        });

  if (error) {
  showToast(`Kunne ikke lagre: ${error.message}`, "error");
  return;
}
    setEditing(null);
    setNewZone("");
    setNewLocation("");
    setNewQuantity("0");

    await loadData();
      
  }

  
const ignoredCollections = useMemo(
  () =>
    new Set([
      "AVADA Email Marketing - Newest Products",
      "AVADA Email Marketing - Best Sellers",
    ]),
  []
);

const collections = useMemo(() => {
  const map = new Map<string, { title: string; handle: string | null }>();

  products.forEach((product) => {
    product.product_collections?.forEach((collection) => {
      if (ignoredCollections.has(collection.title)) return;

      map.set(collection.title, {
        title: collection.title,
        handle: collection.handle,
      });
    });
  });

  return Array.from(map.values()).sort((a, b) =>
    a.title.localeCompare(b.title, "nb")
  );
}, [products, ignoredCollections]);

  const filtered = useMemo(() => {
    let result = products;
    const q = query.trim().toLowerCase();

    if (q) {
      result = result.filter((product) => {
        const meta = getMeta(product);


        result = [...result].sort((a, b) => {
  const aName = a.product_name.toLowerCase();
  const bName = b.product_name.toLowerCase();

  if (sortMode === "az") {
    return aName.localeCompare(bName, "nb");
  }

  return bName.localeCompare(aName, "nb");
});
        return [
          product.sku ?? "",
          product.product_name,
          product.variant_name ?? "",
          product.vendor ?? "",
          product.product_type ?? "",
          meta.locationCode ?? "",
          meta.zoneLabel ?? "",
          product.product_collections?.map((c) => c.title).join(" ") ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((product) => {
        const meta = getMeta(product);
        const diff = (product.shopify_quantity ?? 0) - meta.quantity;

        if (statusFilter === "missing") return meta.status === "missing";
        if (statusFilter === "zone") return meta.status === "zone";
        if (statusFilter === "location") return meta.status === "location";
        if (statusFilter === "diff") return diff !== 0;

        return true;
      });
    }
if (collectionFilter !== "all") {
  result = result.filter((product) =>
    product.product_collections?.some(
      (collection) => collection.title === collectionFilter
    )
  );
}
    if (zoneFilter !== "all") {
      result = result.filter((product) => {
        const meta = getMeta(product);
        return meta.zoneId === zoneFilter;
      });
    }

    

    return result;
  }, [products, query, statusFilter, zoneFilter, collectionFilter, sortMode]);

  function openModal(product: ProductRow) {
    const inventory = product.inventory?.[0];

    const zoneId =
      inventory?.locations?.zone_id ||
      inventory?.locations?.zones?.id ||
      inventory?.zone_id ||
      "";

    setEditing(product);
    setNewZone(zoneId);
    setNewLocation(inventory?.locations?.id ?? "");
    setNewQuantity(String(inventory?.quantity ?? 0));
  }

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
         
  <SnakeHero
  eyebrow="SNAKE / Produkter"
  title="Varesøk"
  description="Sett sone først, og nøyaktig lokasjon senere når lageret er ferdig merket."
  searchValue={query}
  onSearchChange={setQuery}
  searchPlaceholder="SKU, produktnavn, sone eller lokasjon"
/>

<SnakeToolbar
  left={
    <>
      {[
        { key: "all", label: "Alle" },
        { key: "missing", label: "Mangler" },
        { key: "zone", label: "Har sone" },
        { key: "location", label: "Har lokasjon" },
        { key: "diff", label: "Avvik" },
      ].map((filter) => (
        <button
          key={filter.key}
          onClick={() =>
            setStatusFilter(
              filter.key as "all" | "missing" | "zone" | "location" | "diff"
            )
          }
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition duration-300 ${
  statusFilter === filter.key
    ? "bg-[#b58a14] text-white"
    : "bg-white/10 text-white"
} ${
  recentlyUpdated && filter.key === "zone"
    ? "scale-[1.04] ring-2 ring-[#b58a14]/40"
    : ""
}`}
        >
          {filter.label}
        </button>
      ))}
    </>
  }
  right={
    <>
      <SnakeDropdown
        value={collectionFilter}
        onChange={setCollectionFilter}
        width="w-full sm:w-[240px]"
        options={[
          { value: "all", label: "Alle collections" },
          ...collections.map((collection) => ({
            value: collection.title,
            label: collection.title,
          })),
        ]}
      />

      <SnakeDropdown
        value={zoneFilter}
        onChange={setZoneFilter}
        width="w-full sm:w-[200px]"
        options={[
          { value: "all", label: "Alle soner" },
          ...zones.map((zone) => ({
            value: zone.id,
            label: `${zone.code} — ${zone.name}`,
          })),
        ]}
      />
    </>
  }
/>
{filtered.length > 0 && (
  <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4 sm:px-8">
    {(() => {
      const missing = products.filter(
        (p) => getMeta(p).status === "missing"
      ).length;

      const diff = products.filter((p) => {
        const meta = getMeta(p);
        return (p.shopify_quantity ?? 0) - meta.quantity !== 0;
      }).length;

      if (missing > 0) {
        return (
          <div className="flex items-center justify-between rounded-2xl bg-[#b58a14]/10 px-4 py-3">
            <span className="text-sm font-semibold text-neutral-900">
              {missing} produkter mangler plassering
            </span>

            <button
              onClick={() => setStatusFilter("missing")}
              className="text-sm font-semibold text-[#055a7d] underline"
            >
              Vis →
            </button>
          </div>
        );
      }

      if (diff > 0) {
        return (
          <div className="flex items-center justify-between rounded-2xl bg-[#a77e05]/10 px-4 py-3">
            <span className="text-sm font-semibold text-neutral-900">
              {diff} produkter har avvik
            </span>

            <button
              onClick={() => setStatusFilter("diff")}
              className="text-sm font-semibold text-[#055a7d] underline"
            >
              Vis →
            </button>
          </div>
        );
      }

      return (
        <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          Lageret ser ryddig ut ✔
        </div>
      );
    })()}
  </div>
)}
  <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7">
            <div
  className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition duration-500 ${
    recentlyUpdated ? "ring-2 ring-[#b58a14]/35" : ""
  }`}
>
              <div className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                    Produktliste
                  </h2>

                  <p className="mt-1 text-sm text-neutral-500">
                    {loading
                      ? "Henter produkter..."
                      : `${filtered.length} av ${products.length} produkter vises`}
                  </p>
                </div>

                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:w-auto sm:py-2"
                  >
                    Nullstill søk
                  </button>
                )}
              </div>

              <div className="divide-y divide-neutral-100 lg:hidden">
                {loading ? (
                  <Empty text="Laster produkter..." />
                ) : filtered.length === 0 ? (
                  <Empty text="Ingen treff." />
                ) : (
                  filtered.map((product) => (
                    <MobileProductCard
                      key={product.id}
                      product={product}
                      selected={selected.includes(product.id)}
                      onToggleSelected={() =>
                        setSelected((prev) =>
                          prev.includes(product.id)
                            ? prev.filter((id) => id !== product.id)
                            : [...prev, product.id]
                        )
                      }
                      onEdit={() => openModal(product)}
                    />
                  ))
                )}
              </div>

              <div className="hidden min-h-[680px] overflow-x-auto lg:block">
                <table className="min-w-full table-fixed border-collapse">
                  <thead className="bg-white text-left text-xs uppercase tracking-[0.14em] text-neutral-500">
                    <tr>
  <th className="w-[48px] px-5 py-4 font-semibold">
    <input
      type="checkbox"
      checked={selected.length === filtered.length && filtered.length > 0}
      onChange={() =>
        setSelected(
          selected.length === filtered.length
            ? []
            : filtered.map((product) => product.id)
        )
      }
    />
  </th>

  <th className="px-5 py-4 font-semibold">
    <button
      onClick={() => setSortMode((current) => (current === "az" ? "za" : "az"))}
      className="inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-[#055a7d]"
    >
      Produkt {sortMode === "az" ? "A–Å" : "Å–A"}
    </button>
  </th>

  <th className="w-[150px] px-5 py-4 font-semibold">SKU</th>
  <th className="w-[155px] px-5 py-4 font-semibold">Antall</th>
  <th className="w-[190px] px-5 py-4 font-semibold">Plassering</th>
  <th className="w-[100px] px-5 py-4 font-semibold">Handling</th>
</tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-sm text-neutral-500"
                        >
                          Laster produkter...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                        colSpan={6}
                          className="px-5 py-12 text-sm text-neutral-500"
                        >
                          Ingen treff.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((product) => {
                        const meta = getMeta(product);

                        return (
                          <tr
  key={product.id}
  className={`h-[104px] border-t border-neutral-100 transition hover:bg-[#055a7d]/[0.025] ${
    selected.includes(product.id)
      ? "bg-[#b58a14]/10 ring-1 ring-[#b58a14]/30"
      : ""
  }`}
>
                            <td className="px-5 py-5 align-middle text-sm">
                              <input
                                type="checkbox"
                                checked={selected.includes(product.id)}
                                onChange={() =>
                                  setSelected((prev) =>
                                    prev.includes(product.id)
                                      ? prev.filter((id) => id !== product.id)
                                      : [...prev, product.id]
                                  )
                                }
                              />
                            </td>
<td className="px-5 py-5 align-middle text-sm text-neutral-900">
  <ProductIdentity product={product} />
</td>

<td className="w-[150px] px-5 py-5 align-middle text-xs font-semibold text-neutral-600">
  {product.sku ? (
    <span className="block truncate">{product.sku}</span>
  ) : (
    <span className="block truncate text-red-600">Mangler SKU</span>
  )}
</td>

<td className="w-[155px] px-5 py-5 align-middle text-sm font-medium text-neutral-800">
  <QuantityDiff product={product} meta={meta} />
</td>

<td className="w-[190px] px-5 py-5 align-middle text-sm">
  <PlacementDisplay meta={meta} />
</td>

<td className="w-[100px] px-5 py-5 align-middle text-sm">
  <button
    onClick={() => openModal(product)}
    className="font-semibold text-[#055a7d] underline-offset-4 hover:underline"
  >
    Endre
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

{selected.length > 0 && (
  <div className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[720px] -translate-x-1/2 rounded-2xl bg-[#b58a14] px-4 py-3 text-white shadow-2xl shadow-black/30">
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-semibold">
        {selected.length} valgt
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelected([])}
          className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white"
        >
          Fjern valg
        </button>

        <button
          onClick={() => setBatchOpen(true)}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          Sett sone
        </button>
      </div>
    </div>
  </div>
)}
<SnakeToast message={toast?.message ?? null} tone={toast?.tone ?? "success"} />
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-3xl bg-white p-6 text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
              Endre plassering
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {editing.sku || "Produkt uten SKU"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {editing.product_name}
            </p>

            <label className="mt-6 block text-sm font-medium text-neutral-700">
              Sone
            </label>

            <select
              value={newZone}
              onChange={(e) => setNewZone(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
            >
              <option value="">Velg sone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.code} — {zone.name}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium text-neutral-700">
              Lokasjon
            </label>

            <select
              value={newLocation}
              onChange={(e) => {
                const locationId = e.target.value;
                const location = locations.find(
                  (item) => item.id === locationId
                );

                setNewLocation(locationId);

                if (location?.zone_id) {
                  setNewZone(location.zone_id);
                }
              }}
              className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
            >
              <option value="">Ingen eksakt lokasjon ennå</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium text-neutral-700">
              Antall
            </label>

            <input
              type="number"
              min="0"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
            />

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setEditing(null);
                  setNewZone("");
                  setNewLocation("");
                  setNewQuantity("0");
                }}
                className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700"
              >
                Avbryt
              </button>

              <button
                onClick={handleSave}
                className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white"
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}

     {batchOpen && (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
    <div className="w-full rounded-t-3xl bg-white p-6 text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
        Batch assign
      </p>

      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        Sett sone på {selected.length} produkter
      </h2>

      <p className="mt-2 text-sm leading-6 text-neutral-500">
        Produktene får sone nå. Eksakt lokasjon kan settes senere.
      </p>

      <label className="mt-6 block text-sm font-medium text-neutral-700">
        Sone
      </label>

      <select
        value={batchZone}
        onChange={(e) => setBatchZone(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
      >
        <option value="">Velg sone</option>
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.code} — {zone.name}
          </option>
        ))}
      </select>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
  if (batchSaving) return;
  setBatchOpen(false);
  setBatchZone("");
  setSelected([]);
}}
          className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700"
        >
          Avbryt
        </button>

        <button
          onClick={handleBatchSave}
          disabled={!batchZone || batchSaving}
          className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {batchSaving ? "Lagrer..." : `Sett sone`}
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  );
}

function getMeta(product: ProductRow): ProductMeta {
  const inventory = product.inventory?.[0];

  const locationCode = inventory?.locations?.code ?? null;
  const locationZone = inventory?.locations?.zones ?? null;
  const directZone = inventory?.zones ?? null;
  const zone = locationZone || directZone;

  const status: PlacementStatus = locationCode
    ? "location"
    : zone
      ? "zone"
      : "missing";

 return {
  quantity: inventory?.quantity ?? 0,
  locationCode,
  zoneLabel: zone ? `${zone.code} — ${zone.name}` : null,
  zoneId: zone?.id ?? null,
  zoneCode: zone?.code ?? null,
  status,
};
}

function QuantityDiff({
  product,
  meta,
}: {
  product: ProductRow;
  meta: ProductMeta;
}) {
  const shopifyQuantity = product.shopify_quantity ?? 0;
  const snakeQuantity = meta.quantity ?? 0;
  const diff = shopifyQuantity - snakeQuantity;

  return (
    <div className="flex min-h-[58px] flex-col justify-center">
      <span className="font-semibold text-neutral-950">
        Snake: {snakeQuantity}
      </span>

      <span className="text-xs text-neutral-400">
        Shopify: {shopifyQuantity}
      </span>

      {diff > 0 && (
        <span className="mt-1 whitespace-nowrap text-xs font-semibold text-[#a77e05]">
  {diff} ikke plassert
</span>
      )}

      {diff < 0 && (
        <span className="mt-1 whitespace-nowrap text-xs font-semibold text-red-600">
  {Math.abs(diff)} for mye i Snake
</span>
      )}
    </div>
  );
}

function ProductIdentity({ product }: { product: ProductRow }) {
  return (
    <div className="flex h-[64px] items-center gap-4 overflow-hidden">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
            —
          </div>
        )}
      </div>

     <div className="min-w-0 overflow-hidden">
        <p className="line-clamp-2 min-h-[40px] font-semibold leading-5 text-neutral-950">
  {product.product_name}
</p>

      
       
        {product.variant_name && (
          <p className="mt-1 truncate text-xs text-neutral-400">
            {product.variant_name}
          </p>
        )}
      </div>
    </div>
  );
}

function PlacementDisplay({ meta }: { meta: ProductMeta }) {
  if (meta.locationCode) {
    return (
      <span className="rounded-lg border border-[#055a7d]/20 bg-[#055a7d]/5 px-2 py-1 text-xs font-semibold text-[#055a7d]">
        {meta.locationCode}
      </span>
    );
  }

  if (meta.zoneLabel) {
  const zoneStyle =
    meta.zoneCode && ZONE_STYLES[meta.zoneCode]
      ? ZONE_STYLES[meta.zoneCode]
      : "border-[#a77e05]/20 bg-[#a77e05]/10 text-[#a77e05]";

  return (
    <span
      className={`rounded-lg border px-2 py-1 text-xs font-semibold ${zoneStyle}`}
    >
      {meta.zoneLabel}
    </span>
  );
}

 return (
  <span className="whitespace-nowrap font-semibold text-red-600">
    Mangler plassering
  </span>
);
}

function MobileProductCard({
  product,
  selected,
  onToggleSelected,
  onEdit,
}: {
  product: ProductRow;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
}) {
  const meta = getMeta(product);

  return (
    <article className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          
          <ProductIdentity product={product} />

          <p className="mt-3 text-sm font-semibold text-neutral-950">
            {product.sku || <span className="text-red-600">Mangler SKU</span>}
          </p>
        </div>

        <Status status={meta.status} />
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-neutral-50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Plassering
          </p>

          <div className="mt-2">
            <PlacementDisplay meta={meta} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
          <span className="text-sm text-neutral-500">Antall</span>

          <div className="text-right">
            <p className="text-base font-semibold text-neutral-950">
              {meta.quantity}
            </p>

            <p className="text-xs text-neutral-400">
              Shopify: {product.shopify_quantity ?? 0}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-3">
        <button
          onClick={onToggleSelected}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            selected
              ? "border-[#b58a14] bg-[#b58a14] text-white"
              : "border-neutral-300 bg-white text-neutral-700"
          }`}
        >
          {selected ? "Valgt" : "Velg"}
        </button>

        <button
          onClick={onEdit}
          className="rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white"
        >
          Endre plassering
        </button>
      </div>
    </article>
  );
}

function Status({ status }: { status: PlacementStatus }) {
  if (status === "missing") {
    return <StatusPill text="Mangler" tone="danger" />;
  }

  if (status === "zone") {
    return <StatusPill text="Har sone" tone="warning" />;
  }

  return <StatusPill text="OK" tone="ok" />;
}

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: "ok" | "warning" | "danger";
}) {
  const styles = {
    ok: "border-green-200 bg-green-50 text-green-700",
    warning: "border-[#a77e05]/20 bg-[#a77e05]/10 text-[#a77e05]",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {text}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-10 text-sm text-neutral-500">{text}</div>;
}