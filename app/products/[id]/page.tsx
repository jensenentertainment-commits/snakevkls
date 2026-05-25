"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../../components/SnakeNav";
import SnakeFooter from "../../components/SnakeFooter";
import ActivityItemCard from "../../components/activity/ActivityItemCard";
import SnakeHero from "../../components/SnakeHero";
import EditPlacementModal from "../../components/products/EditPlacementModal";
import StockMovementModal from "../../components/products/StockMovementModal";
import type {
  LocationOption,
  ProductRow,
  ZoneOption,
} from "../../components/products/types";

export default function ProductPage() {
 
  const [product, setProduct] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const params = useParams();
const id = Array.isArray(params.id) ? params.id[0] : params.id;
const [showPlacementModal, setShowPlacementModal] = useState(false);
const [showMovementModal, setShowMovementModal] = useState(false);

const [zones, setZones] = useState<ZoneOption[]>([]);
const [locations, setLocations] = useState<LocationOption[]>([]);

const [newZone, setNewZone] = useState("");
const [newLocation, setNewLocation] = useState("");
const [newQuantity, setNewQuantity] = useState("0");

const [movementQty, setMovementQty] = useState("");
const [movementReason, setMovementReason] = useState("manual_sale");
const [movementNote, setMovementNote] = useState("");

const [saveSaving, setSaveSaving] = useState(false);
const [movementSaving, setMovementSaving] = useState(false);



 useEffect(() => {
  if (!id) return;
  load();
}, [id]);

useEffect(() => {
  async function loadOptions() {
    const [{ data: zoneData }, { data: locationData }] = await Promise.all([
      supabase.from("zones").select("id, code, name").order("code"),
      supabase
        .from("locations")
        .select("id, code, zone_id")
        .eq("active", true)
        .order("code"),
    ]);

    setZones(zoneData ?? []);
    setLocations(locationData ?? []);
  }

  loadOptions();
}, []);



async function handleSavePlacement() {
  if (!inv?.id) return;

  setSaveSaving(true);

  const { error } = await supabase
    .from("inventory")
    .update({
      zone_id: newZone || null,
      location_id: newLocation || null,
      quantity: Number(newQuantity),
    })
    .eq("id", inv.id);

  setSaveSaving(false);

  if (error) {
    console.error(error);
    return;
  }

  setShowPlacementModal(false);
  window.location.reload();
}

async function handleSaveMovement() {
  if (!inv?.id) return;

  const qty = Number(movementQty);

  if (!qty || qty <= 0) return;

  setMovementSaving(true);

  const nextQuantity = Math.max(0, lagerQty - qty);

  const { error: inventoryError } = await supabase
    .from("inventory")
    .update({
      quantity: nextQuantity,
    })
    .eq("id", inv.id);

  if (inventoryError) {
    console.error(inventoryError);
    setMovementSaving(false);
    return;
  }

  await supabase.from("stock_movements").insert({
    inventory_id: inv.id,
    product_id: product.id,
    quantity: -qty,
    reason: movementReason,
    note: movementNote || null,
  });

  setMovementSaving(false);
  setShowMovementModal(false);
  setMovementQty("");
  setMovementReason("manual_sale");
  setMovementNote("");

  window.location.reload();
}

  async function load() {
    setLoading(true);

    const { data } = await supabase
      .from("products")
      .select(`
        id,
        product_name,
        variant_name,
        sku,
        image_url,
        shopify_quantity,
        inventory (
          id,
          quantity,
          zone_id,
          zones (
            code,
            name
          ),
          locations (
  id,
  code,
  zone_id
)
        )
      `)
      .eq("id", id)
      .single();

    setProduct(data);
   const loadedInv = data?.inventory?.[0] as
  | {
      zone_id: string | null;
      quantity: number;
      locations: {
        id: string;
      } | null;
    }
  | undefined;

setNewZone(loadedInv?.zone_id ?? "");
setNewLocation(loadedInv?.locations?.id ?? "");
setNewQuantity(String(loadedInv?.quantity ?? 0));

   const productId = Array.isArray(id) ? id[0] : id;

const { data: activityData } = await supabase
  .from("activity_log")
  .select(`
    id,
    action,
    title,
    description,
    metadata,
    actor_email,
    actor_name,
    created_at
  `)
  .eq("metadata->>product_id", productId)
  .order("created_at", { ascending: false })
  .limit(30);

    setActivity(activityData ?? []);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#062f3b] text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
          <SnakeNav />
          <div className="mt-6 rounded-3xl bg-white p-8 text-neutral-500">
            Laster produkt...
          </div>
          <SnakeFooter />
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-[#062f3b] text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
          <SnakeNav />
          <div className="mt-6 rounded-3xl bg-white p-8 text-neutral-950">
            Produkt ikke funnet.
          </div>
          <SnakeFooter />
        </div>
      </main>
    );
  }

  const inv = product.inventory?.[0];
  const lagerQty = inv?.quantity ?? 0;
  const shopifyQty = product.shopify_quantity ?? 0;
  const diff = shopifyQty - lagerQty;
 





  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
          <SnakeHero
  eyebrow="Snake / Produkt"
  title={product.product_name}
  description={
    product.variant_name
      ? `${product.variant_name}${product.sku ? ` · SKU ${product.sku}` : ""}`
      : product.sku
        ? `SKU ${product.sku}`
        : "Produkt uten SKU"
  }
  backHref="/products"
  backLabel="Tilbake til produkter"
  right={
    product.image_url ? (
      <div className="flex justify-end">
        <div className="h-32 w-32 overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-2xl">
          <img
            src={product.image_url}
            alt={product.product_name}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    ) : undefined
  }
/>

          <div className="grid gap-5 border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 lg:grid-cols-5">
            <InfoCard label="SKU" value={product.sku || "Mangler SKU"} />
            <InfoCard label="Lager" value={lagerQty} />
            <InfoCard label="Shopify" value={shopifyQty} />
            <InfoCard
              label="Diff"
              value={diff === 0 ? "OK" : `${diff > 0 ? "+" : ""}${diff}`}
              tone={diff === 0 ? "ok" : "warn"}
            />
            <InfoCard
              label="Lokasjon"
              value={inv?.locations?.code ?? "Ingen lokasjon"}
              tone={inv?.locations?.code ? "ok" : "warn"}
            />
          </div>
<div className="border-t border-neutral-200 bg-white px-5 py-5 sm:px-8">
  <div className="flex flex-col gap-4 rounded-[24px] border border-neutral-200 bg-neutral-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        Handlinger
      </p>

      <p className="mt-1 text-sm text-neutral-600">
        Oppdater plassering eller registrer lagerbevegelse.
      </p>
    </div>

    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        onClick={() => setShowPlacementModal(true)}
        className="rounded-2xl bg-[#055a7d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#044c6a]"
      >
        Endre plassering
      </button>

      <button
        onClick={() => setShowMovementModal(true)}
        className="rounded-2xl border border-[#b58a14]/25 bg-[#b58a14]/10 px-5 py-3 text-sm font-semibold text-[#8a6704] transition hover:bg-[#b58a14]/15"
      >
        Registrer uttak
      </button>
    </div>
  </div>
</div>
          <div className="grid gap-5 border-t border-neutral-200 bg-neutral-50 px-5 py-6 sm:px-8 lg:grid-cols-2">
            <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
              <h2 className="text-lg font-semibold tracking-tight">
                Plassering
              </h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between rounded-2xl bg-neutral-50 px-4 py-3">
                  <span className="text-neutral-500">Sone</span>
                  <span className="font-semibold">
                    {inv?.zones
                      ? `${inv.zones.code} — ${inv.zones.name}`
                      : "Ingen sone"}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-neutral-50 px-4 py-3">
                  <span className="text-neutral-500">Lokasjon</span>
                  <span className="font-semibold">
                    {inv?.locations?.code ?? "Ikke detaljplassert"}
                  </span>
                </div>
              </div>
            </section>

            

            <section className="rounded-[24px] border border-neutral-200 bg-white p-6">
              <h2 className="text-lg font-semibold tracking-tight">
                Siste aktivitet
              </h2>

              {activity.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-500">
                  Ingen aktivitet registrert på dette produktet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {activity.map((item) => (
  <ActivityItemCard
    key={item.id}
    item={item}
    showProductLink={false}
  />
))}
                </div>
              )}
            </section>
          </div>
        </section>
{showPlacementModal && (
  <EditPlacementModal
    editing={product}
    locations={locations}
    zones={zones}
    newZone={newZone}
    setNewZone={setNewZone}
    newLocation={newLocation}
    setNewLocation={setNewLocation}
    newQuantity={newQuantity}
    setNewQuantity={setNewQuantity}
    saveSaving={saveSaving}
    onClose={() => setShowPlacementModal(false)}
    onSave={handleSavePlacement}
  />
)}

{showMovementModal && (
  <StockMovementModal
    product={product}
    movementQty={movementQty}
    setMovementQty={setMovementQty}
    movementReason={movementReason}
    setMovementReason={setMovementReason}
    movementNote={movementNote}
    setMovementNote={setMovementNote}
    movementSaving={movementSaving}
    onClose={() => setShowMovementModal(false)}
    onSave={handleSaveMovement}
  />
)}
        <SnakeFooter />
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "ok" | "warn";
}) {
  const toneClass = {
    neutral: "border-neutral-200 bg-white text-neutral-950",
    ok: "border-[#14565b]/25 bg-[#14565b]/8 text-[#14565b]",
    warn: "border-[#a77e05]/20 bg-[#a77e05]/10 text-[#8a6704]",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-60">
        {label}
      </p>

      <p className="mt-2 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}