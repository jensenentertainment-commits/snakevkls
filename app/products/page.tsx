"use client";

import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LagerDropdown } from "../components/lager/LagerDropdown";
import { LagerToolbar } from "../components/lager/LagerToolbar";
import { LagerHero } from "../components/lager/LagerHero";
import { LagerViewTabs } from "../components/lager/LagerViewTabs";
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
import type { Role } from "@/lib/auth/roles";
import { Progress } from "../components/design-system";



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

const [role, setRole] = useState<Role | null>(null);

useEffect(() => {
  loadRole();
}, []);

async function loadRole() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  setRole(data?.active ? (data.role as Role) : null);
}

const canWrite =
  role === "admin" ||
  role === "user" ||
  role === "warehouse";



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

const total = products.length;

const missingCount = products.filter(
  (product) => getMeta(product).status === "missing"
).length;

const diffCount = products.filter((product) => {
  const meta = getMeta(product);
  return (product.shopify_quantity ?? 0) - meta.quantity !== 0;
}).length;

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
    <>
  <section className="overflow-hidden rounded-snake-card bg-snake-surface text-snake-text-primary shadow-snake-overlay sm:rounded-snake-shell">
  <LagerHero
    eyebrow="SNAKE / Produkter"
    title="Varesøk"
    description="Sett sone først, og nøyaktig lokasjon senere når lageret er ferdig merket."
    searchValue={query}
    onSearchChange={setQuery}
    searchPlaceholder="SKU, produktnavn, sone eller lokasjon"
  />



<LagerToolbar
  left={
    <LagerViewTabs
      activeId={statusFilter}
      ariaLabel="Produktvisning"
      items={[
        { id: "all", label: "Alle" },
        { id: "missing", label: "Mangler" },
        { id: "zone", label: "Har sone" },
        { id: "location", label: "Har lokasjon" },
        { id: "diff", label: "Avvik" },
      ]}
      onChange={(id) => {
        const key = id as
          | "all"
          | "missing"
          | "zone"
          | "location"
          | "diff";
        setStatusFilter(key);
        const url = new URL(window.location.href);
        url.searchParams.set("status", key);
        window.history.replaceState(null, "", url.toString());
      }}
    />
  }
  right={
    <>
    {role === "admin" && (
    <button
    
  onClick={handleShopifySync}
  disabled={syncingShopify}
  className="inline-flex items-center gap-2 rounded-snake-control border border-snake-border-on-dark-subtle bg-snake-app-elevated px-4 py-2 text-sm font-semibold text-snake-text-on-dark transition hover:bg-snake-surface/[0.1] hover:text-snake-text-on-dark disabled:opacity-50"
>
  <RefreshCw
    className={`h-4 w-4 ${
      syncingShopify ? "animate-spin" : ""
    }`}
  />

  {syncingShopify ? "Synker..." : "Sync Shopify"}
</button>
)}

{lastShopifySync && (
  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-snake-text-on-dark-muted">
  Synket {lastShopifySync}
</span>
)}


      <LagerDropdown
      variant="dark"
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

      <LagerDropdown
      variant="dark"
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
  <div className="border-t border-snake-border-default bg-snake-surface-subtle px-5 py-4 sm:px-8">
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
  <div className="grid gap-4 rounded-snake-action border border-snake-brand/20 bg-snake-warning-surface p-4 shadow-snake-card lg:grid-cols-[1fr_280px_auto] lg:items-center">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-snake-brand-strong">
        Neste steg
      </p>
      <p className="mt-1 text-sm font-semibold text-snake-text-primary">
        {missing} produkter mangler plassering
      </p>
    </div>

    <Progress
      label={`${percent}% ferdig · ${placed} av ${total} produkter plassert`}
      max={total}
      tone="warning"
      value={placed}
    />

    <div className="flex flex-wrap gap-2 lg:justify-end">
      <button
        onClick={() => setStatusFilter("missing")}
        className="rounded-snake-control border border-snake-primary/15 bg-snake-surface px-3 py-2 text-sm font-semibold text-snake-link"
      >
        Vis mangler
      </button>

      {canWrite && (
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
          className="rounded-snake-control bg-snake-primary px-3 py-2 text-sm font-semibold text-snake-text-on-dark shadow-snake-card"
        >
          Velg alle
        </button>
      )}
    </div>
  </div>
);
      }

      if (diff > 0) {
        return (
          <div className="flex items-center justify-between rounded-snake-action bg-snake-brand-strong/10 px-4 py-3">
            <span className="text-sm font-semibold text-snake-text-primary">
              {diff} produkter har avvik
            </span>

            <button
              onClick={() => setStatusFilter("diff")}
              className="text-sm font-semibold text-snake-link underline"
            >
              Vis →
            </button>
          </div>
        );
      }

      return (
        <div className="rounded-snake-action bg-snake-success-surface px-4 py-3 text-sm font-semibold text-snake-success">
          Lageret ser ryddig ut ✔
        </div>
      );
    })()}
  </div>
)}
  <div
  ref={tableRef}
  className="border-t border-snake-border-default bg-snake-surface px-5 py-6 sm:px-8 sm:py-7"
>
            <div
  className={`overflow-hidden rounded-snake-action border border-snake-border-default bg-snake-surface shadow-snake-card transition duration-500 ${
    recentlyUpdated ? "ring-2 ring-snake-brand/35" : ""
  }`}
>
           <div className="flex flex-col gap-3 border-b border-snake-border-default bg-snake-surface-subtle px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
  <div>
    <h2 className="text-lg font-semibold tracking-tight text-snake-text-primary">
      Produktliste
    </h2>

    <p className="mt-1 text-sm text-snake-text-secondary">
      {loading
        ? "Børre venter på produktdata."
        : diffCount > 0 && missingCount > 0
          ? `Børre ser ${diffCount} avvik og ${missingCount} produkter uten plassering. Dette er ikke dekor.`
          : diffCount > 0
            ? `Børre ser ${diffCount} avvik. Tallene bør få litt oppmerksomhet.`
            : missingCount > 0
              ? `Børre ser ${missingCount} produkter uten plassering. De trenger et hjem.`
              : "Børre finner ingen store produktproblemer akkurat nå."}
    </p>
  </div>

  <div className="flex flex-col gap-2 sm:items-end">
    <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-snake-text-disabled sm:pt-1 sm:text-right">
      {loading
        ? "Henter produkter"
        : `Viser ${filtered.length} av ${products.length}`}
    </p>

    {query && (
      <button
        onClick={() => setQuery("")}
        className="w-full rounded-snake-action border border-snake-border-strong bg-snake-surface px-4 py-3 text-sm font-semibold text-snake-text-secondary transition hover:bg-snake-surface-subtle sm:w-auto sm:py-2"
      >
        Nullstill søk
      </button>
    )}
  </div>
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
  canWrite={canWrite}
  onToggleSelected={() => {
  if (!canWrite) return;

  setSelected((prev) =>
    prev.includes(product.id)
      ? prev.filter((id) => id !== product.id)
      : [...prev, product.id]
  );
}}
  onEdit={() => {
  if (!canWrite) return;
  openModal(product);
}}
  
/>
                  ))
                )}
              </div>

              <div className="hidden min-h-[680px] overflow-x-auto lg:block">
                <table className="min-w-full table-fixed border-collapse">
                  <thead className="bg-snake-surface text-left text-xs uppercase tracking-[0.14em] text-snake-text-muted">
                    <tr>
  <th className="w-[48px] px-5 py-4 font-semibold">
    {canWrite && (
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
    )}
  </th>
  

  <th className="px-5 py-4 font-semibold">
    <button
      onClick={() => setSortMode((current) => (current === "az" ? "za" : "az"))}
      className="inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-snake-link"
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
                          className="px-5 py-12 text-sm text-snake-text-muted"
                        >
                          Laster produkter...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                        colSpan={6}
                          className="px-5 py-12 text-sm text-snake-text-muted"
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
  className={`h-[104px] cursor-pointer border-t transition ${
  selected.includes(product.id)
    ? "border-l-4 border-l-snake-brand border-t-snake-border-subtle bg-snake-surface ring-1 ring-snake-brand-border"
    : meta.status === "missing"
      ? "border-l-4 border-l-snake-brand/45 border-t-snake-border-subtle bg-snake-warning-surface/38"
      : "border-l-4 border-l-transparent border-t-snake-border-subtle bg-snake-surface"
} hover:bg-snake-primary/[0.025]`}
>
                            <td className="px-5 py-5 align-middle text-sm">
                              {canWrite && (
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
                              )}
                            </td>
<td className="px-5 py-5 align-middle text-sm text-snake-text-primary">
  <ProductIdentity product={product} />
</td>

<td className="w-[150px] px-5 py-5 align-middle text-xs font-semibold text-snake-text-secondary">
  {product.sku ? (
    <span className="block truncate">{product.sku}</span>
  ) : (
    <span className="block truncate text-snake-danger">Mangler SKU</span>
  )}
</td>

<td className="w-[170px] px-5 py-5 align-middle text-sm font-medium text-snake-text-primary">
  <div className="flex flex-col gap-2">
    <QuantityDiff product={product} meta={meta} />

{canWrite && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setMovementProduct(product);
      }}
      className="w-fit text-xs font-semibold text-snake-brand-strong underline-offset-4 hover:underline"
    >
      Registrer uttak
    </button>
    )}
  </div>
</td>

<td className="w-[190px] px-5 py-5 align-middle text-sm">
  {meta.status === "missing" && canWrite ? (
    
    <div className="flex flex-col gap-1.5">
      
  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-snake-brand-strong">
    Velg sone
  </span>

  <div className="flex w-[132px] items-center justify-end gap-1.5">
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
    disabled={inlineSaving === product.id}
    className="h-8 w-[76px] rounded-lg border border-snake-border-default bg-snake-surface px-2 text-[11px] font-semibold text-snake-text-primary shadow-snake-card outline-none transition hover:border-snake-primary/30 focus:border-snake-primary/50 focus:ring-2 focus:ring-snake-primary/10 disabled:opacity-50"
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
    className="h-8 w-[48px] rounded-lg bg-snake-primary text-[11px] font-bold text-snake-text-on-dark shadow-snake-card transition hover:bg-snake-primary-hover disabled:bg-snake-neutral-surface disabled:text-snake-text-muted"
  >
    {inlineSaving === product.id ? "..." : "Sett"}
  </button>
</div>
</div>
  ) : meta.zoneLabel ? (
  <span
    className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
      meta.zoneCode && ZONE_STYLES[meta.zoneCode]
        ? ZONE_STYLES[meta.zoneCode]
        : "border-snake-primary/20 bg-snake-primary/5 text-snake-link"
    }`}
  >
    {meta.zoneLabel}
  </span>
) : (
  <span className="text-xs font-semibold text-snake-text-disabled">
    Ingen sone
  </span>
)}
</td>

<td className="w-[140px] px-5 py-5 align-middle text-sm">
  {meta.locationCode ? (
    <PlacementDisplay meta={meta} />
  ) : meta.zoneId && canWrite ? (
  <button
      onClick={(e) => {
        e.stopPropagation();
        openModal(product);
      }}
      className="text-xs font-semibold text-snake-link underline"
    >
      Sett lokasjon
    </button>
  ) : (
    <span className="text-xs text-snake-text-disabled">Ingen lokasjon</span>
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


{canWrite && selected.length > 0 && (
  <div className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[720px] -translate-x-1/2 rounded-snake-action border border-snake-brand/25 bg-snake-app-elevated/95 px-4 py-3 text-snake-text-on-dark backdrop-blur-xl shadow-snake-overlay">
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-semibold">
        {selected.length} valgt
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelected([])}
          className="rounded-snake-control bg-snake-app-elevated px-4 py-2 text-sm font-semibold text-snake-text-on-dark"
        >
          Fjern valg
        </button>

        <button
          onClick={() => setBatchOpen(true)}
          className="rounded-snake-control bg-snake-surface px-4 py-2 text-sm font-semibold text-snake-text-primary"
        >
          Sett sone
        </button>
      </div>
    </div>
  </div>
)}
<SnakeToast message={toast?.message ?? null} tone={toast?.tone ?? "success"} />
      {canWrite && editing && (
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

     {canWrite && batchOpen && (
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

{canWrite && movementProduct && (
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
    </>
  );
}
  


function Empty({ text }: { text: string }) {
  return <div className="px-5 py-10 text-sm text-snake-text-muted">{text}</div>;
}

export default function ProductsPage() {
  return (
    <RoleGate allowedRoles={["admin", "user", "warehouse"]}>
      <Suspense fallback={null}>
        <ProductsPageContent />
      </Suspense>
    </RoleGate>
  );
}
