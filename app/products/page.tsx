"use client";

import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";
import SnakeDropdown from "../components/SnakeDropdown";
import SnakeToolbar from "../components/SnakeToolbar";
import SnakeHero from "../components/SnakeHero";
import SnakeToast from "../components/SnakeToast";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { RefreshCw } from "lucide-react";
import ProductIdentity from "../components/products/ProductIdentity";
import QuantityDiff from "../components/products/QuantityDiff";
import PlacementDisplay from "../components/products/PlacementDisplay";
import { ZONE_STYLES } from "../components/products/constants";
import MobileProductCard from "../components/products/MobileProductCard";
import type {
  ProductRow,
  ZoneOption,
  LocationOption,
} from "../components/products/types";
import { getMeta } from "../components/products/utils";
import { useProductsFiltering } from "../components/products/useProductsFiltering";
import EditPlacementModal from "../components/products/EditPlacementModal";
import BatchAssignModal from "../components/products/BatchAssignModal";
import StockMovementModal from "../components/products/StockMovementModal";
import { useProductsActions } from "../components/products/useProductsActions";
import RoleGate from "../components/auth/RoleGate";

function ProductsPageContent() {
  const [inlineZone, setInlineZone] = useState<Record<string, string>>({});
  const [inlineSaving, setInlineSaving] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncingShopify, setSyncingShopify] = useState(false);
  const [lastShopifySync, setLastShopifySync] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"az" | "za">("az");
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [movementProduct, setMovementProduct] = useState<ProductRow | null>(null);
  const [movementQty, setMovementQty] = useState("1");
  const [movementReason, setMovementReason] = useState("manual_sale");
  const [movementNote, setMovementNote] = useState("");
  const [movementSaving, setMovementSaving] = useState(false);
  const [newZone, setNewZone] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newQuantity, setNewQuantity] = useState("0");
  const [saveSaving, setSaveSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchZone, setBatchZone] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [toast, setToast] = useState<{
  message: string;
  tone: "success" | "error";
} | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState(false);
  const searchParams = useSearchParams();
  const tableRef = useRef<HTMLDivElement | null>(null);



  const [statusFilter, setStatusFilter] = useState<
    "all" | "missing" | "zone" | "location" | "diff"
  >("all");

  const [zoneFilter, setZoneFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  useEffect(() => {
    loadData();
  }, []);

 const statusParam = searchParams.get("status");

useEffect(() => {
  const status = statusParam

  if (
    status === "missing" ||
    status === "zone" ||
    status === "location" ||
    status === "diff"
  ) {
    setStatusFilter(status);

    // scroll ned til tabell etter load
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 120);
  }
}, [statusParam]);

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
    
    setLocations((locationsRes.data as LocationOption[]) ?? []);
    setZones((zonesRes.data as ZoneOption[]) ?? []);
    setLoading(false);
  }

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

const { collections, filtered } = useProductsFiltering({
  products,
  query,
  statusFilter,
  zoneFilter,
  collectionFilter,
  sortMode,
});


const {
  handleShopifySync,
  handleBatchSave,
  handleInlineSave,
  handleSave,
  handleStockMovement,
} = useProductsActions({
  products,
  zones,

  inlineZone,
  inlineSaving,
  setInlineZone,
  setInlineSaving,

  syncingShopify,
  setSyncingShopify,
  setLastShopifySync,

  selected,
  setSelected,
  batchZone,
  setBatchZone,
  batchSaving,
  setBatchSaving,
  setBatchOpen,

  editing,
  setEditing,
  newZone,
  setNewZone,
  newLocation,
  setNewLocation,
  newQuantity,
  setNewQuantity,
  saveSaving,
  setSaveSaving,

  movementProduct,
  setMovementProduct,
  movementQty,
  setMovementQty,
  movementReason,
  setMovementReason,
  movementNote,
  setMovementNote,
  movementSaving,
  setMovementSaving,

  loadData,
  showToast,
  setRecentlyUpdated,
});

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
      
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

  <div className={syncingShopify ? "animate-pulse" : ""}></div>
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
          onClick={() => {
  const key =
    filter.key as "all" | "missing" | "zone" | "location" | "diff";

  setStatusFilter(key);

  const url = new URL(window.location.href);
  url.searchParams.set("status", key);
  window.history.replaceState(null, "", url.toString());
}}
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
    <button
    
  onClick={handleShopifySync}
  disabled={syncingShopify}
  className="inline-flex items-center gap-2 rounded-xl bg-[#055a7d] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#04495f] disabled:opacity-50"
>
  <RefreshCw
    className={`h-4 w-4 ${
      syncingShopify ? "animate-spin" : ""
    }`}
  />

  {syncingShopify ? "Synker..." : "Sync Shopify"}
</button>

{lastShopifySync && (
  <span className="text-xs font-semibold text-white/60">
    Sist synket {lastShopifySync}
  </span>
)}

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
const total = products.length;
const placed = products.filter(
  (p) => getMeta(p).status !== "missing"
).length;

const percent = Math.round((placed / total) * 100);
      if (missing > 0) {
        return (
      <div className="border-t border-neutral-200 bg-white px-5 py-5 sm:px-8">
  <div className="grid gap-4 rounded-[24px] border border-[#b58a14]/20 bg-[#fbf6e8] p-5 shadow-sm lg:grid-cols-[1fr_320px_auto] lg:items-center">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a77e05]">
        Neste steg
      </p>
      <p className="mt-1 text-base font-semibold text-neutral-950">
        {missing} produkter mangler plassering
      </p>
    </div>

    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-[#b58a14] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-neutral-600">
        {percent}% ferdig · {placed} av {total} produkter plassert
      </p>
    </div>

    <div className="flex flex-wrap gap-2 lg:justify-end">
      <button
        onClick={() => setStatusFilter("missing")}
        className="rounded-xl border border-[#055a7d]/20 bg-white px-4 py-2 text-sm font-semibold text-[#055a7d]"
      >
        Vis mangler
      </button>

      <button
        onClick={() => {
          const missingIds = products
            .filter((product) => getMeta(product).status === "missing")
            .map((product) => product.id);

          setSelected(missingIds);

          if (missingIds.length >= 3) {
            setTimeout(() => setBatchOpen(true), 150);
          }
        }}
        className="rounded-xl bg-[#055a7d] px-4 py-2 text-sm font-semibold text-white shadow-sm"
      >
        Velg alle
      </button>
    </div>
  </div>
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
  <div
  ref={tableRef}
  className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7"
>
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
  meta={getMeta(product)}
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
  <th className="w-[190px] px-5 py-4 font-semibold">Sone</th>
  <th className="w-[100px] px-5 py-4 font-semibold">Lokasjon</th>
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
  onDoubleClick={() => {
  window.location.href = `/products/${product.id}`;
}}
  className={`h-[104px] cursor-pointer border-t border-neutral-100 transition hover:bg-[#055a7d]/[0.025] ${
  selected.includes(product.id)
    ? "bg-[#b58a14]/10 ring-1 ring-[#b58a14]/30"
    : meta.status === "missing"
      ? "bg-[#fbf6e8]/45"
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

<td className="w-[170px] px-5 py-5 align-middle text-sm font-medium text-neutral-800">
  <div className="flex flex-col gap-2">
    <QuantityDiff product={product} meta={meta} />

    <button
      onClick={(e) => {
        e.stopPropagation();
        setMovementProduct(product);
      }}
      className="w-fit text-xs font-semibold text-[#a77e05] underline-offset-4 hover:underline"
    >
      Registrer uttak
    </button>
  </div>
</td>

<td className="w-[190px] px-5 py-5 align-middle text-sm">
  {meta.status === "missing" ? (
    <div className="flex flex-col gap-1.5">
  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a77e05]">
    Velg sone
  </span>

  <div className="flex items-center gap-2">
    <select
      value={inlineZone[product.id] ?? ""}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onChange={(e) =>
        setInlineZone((prev) => ({
          ...prev,
          [product.id]: e.target.value,
        }))
      }
      className="rounded-lg border border-[#b58a14]/30 bg-white px-2 py-1 text-xs font-semibold text-neutral-800"
    >
      <option value="">Sone</option>
      {zones.map((zone) => (
        <option key={zone.id} value={zone.id}>
          {zone.code}
        </option>
      ))}
    </select>

    <button
      onClick={(e) => {
        e.stopPropagation();
        handleInlineSave(product);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      disabled={!inlineZone[product.id] || inlineSaving === product.id}
      className="text-xs font-semibold text-[#055a7d] disabled:opacity-40"
    >
      {inlineSaving === product.id ? "..." : "Lagre"}
    </button>
  </div>
</div>
  ) : meta.zoneLabel ? (
  <span
    className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
      meta.zoneCode && ZONE_STYLES[meta.zoneCode]
        ? ZONE_STYLES[meta.zoneCode]
        : "border-[#055a7d]/20 bg-[#055a7d]/5 text-[#055a7d]"
    }`}
  >
    {meta.zoneLabel}
  </span>
) : (
  <span className="text-xs font-semibold text-neutral-400">
    Ingen sone
  </span>
)}
</td>

<td className="w-[140px] px-5 py-5 align-middle text-sm">
  {meta.locationCode ? (
    <PlacementDisplay meta={meta} />
  ) : meta.zoneId ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openModal(product);
      }}
      className="text-xs font-semibold text-[#055a7d] underline"
    >
      Sett lokasjon
    </button>
  ) : (
    <span className="text-xs text-neutral-400">Ingen lokasjon</span>
  )}
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
  <EditPlacementModal
    editing={editing}
    locations={locations}
    zones={zones}
    newZone={newZone}
    setNewZone={setNewZone}
    newLocation={newLocation}
    setNewLocation={setNewLocation}
    newQuantity={newQuantity}
    setNewQuantity={setNewQuantity}
    saveSaving={saveSaving}
    onClose={() => {
      setEditing(null);
      setNewZone("");
      setNewLocation("");
      setNewQuantity("0");
    }}
    onSave={handleSave}
  />
)}

     {batchOpen && (
  <BatchAssignModal
    selectedCount={selected.length}
    zones={zones}
    batchZone={batchZone}
    setBatchZone={setBatchZone}
    batchSaving={batchSaving}
    onClose={() => {
      if (batchSaving) return;
      setBatchOpen(false);
      setBatchZone("");
      setSelected([]);
    }}
    onSave={handleBatchSave}
  />
)}

{movementProduct && (
  <StockMovementModal
    product={movementProduct}
    movementQty={movementQty}
    setMovementQty={setMovementQty}
    movementReason={movementReason}
    setMovementReason={setMovementReason}
    movementNote={movementNote}
    setMovementNote={setMovementNote}
    movementSaving={movementSaving}
    onClose={() => {
      if (movementSaving) return;
      setMovementProduct(null);
    }}
    onSave={handleStockMovement}
  />
)}
    </main>
  );
}
  


function Empty({ text }: { text: string }) {
  return <div className="px-5 py-10 text-sm text-neutral-500">{text}</div>;
}

export default function ProductsPage() {
  return (
    <RoleGate allowedRoles={["admin", "lager", "viewer"]}>
      <Suspense fallback={null}>
        <ProductsPageContent />
      </Suspense>
    </RoleGate>
  );
}