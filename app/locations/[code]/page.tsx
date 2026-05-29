"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Package, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SnakeNav from "../../components/SnakeNav";
import SnakeFooter from "../../components/SnakeFooter";
import ActivityItemCard from "../../components/activity/ActivityItemCard";
import SnakeHero from "../../components/SnakeHero";

type LocationDetail = {
  id: string;
  code: string;
  active: boolean;
  zone_id: string | null;
  zones: {
    id: string;
    code: string;
    name: string;
  } | null;
  inventory: {
    id: string;
    quantity: number;
    products: {
      id: string;
      sku: string | null;
      product_name: string;
      variant_name: string | null;
    } | null;
  }[];
};
type Role = "admin" | "lager" | "viewer";

export default function LocationDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? "");

  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [skuInput, setSkuInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [saving, setSaving] = useState(false);
  

const [role, setRole] = useState<Role | null>(null);
const canWrite = role === "admin" || role === "lager";
const [activity, setActivity] = useState<any[]>([]);
  const inventoryItems = location?.inventory ?? [];

  const totalQuantity = inventoryItems.reduce(
    (sum, item) => sum + (item.quantity ?? 0),
    0
  );
const isEmpty = inventoryItems.length === 0;
const isHighLoad = inventoryItems.length >= 8 || totalQuantity >= 50;
const missingZone = location ? !location.zone_id : false;
const recentlyChanged = activity.length > 0;

 useEffect(() => {
  loadRole();
}, []);

useEffect(() => {
  if (code) loadLocation();
}, [code]);

async function loadRole() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  setRole((data?.role as Role) ?? null);
}

async function loadLocation() {
  setLoading(true);

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
      .eq("code", code)
      .maybeSingle();

    if (error) {
  console.error("Feil ved henting av lokasjon:", error);
  setLocation(null);
  setActivity([]);
} else if (data) {
  setLocation({
    ...(data as unknown as LocationDetail),
    inventory: ((data as any).inventory ?? []) as LocationDetail["inventory"],
  });

  const { data: activityData } = await supabase
    .from("activity_log")
    .select(`
      id,
      entity_type,
      entity_id,
      action,
      title,
      description,
      metadata,
      actor_email,
      actor_name,
      created_at
    `)
    .eq("metadata->>location_id", data.id)
    .order("created_at", { ascending: false })
    .limit(20);

  setActivity(activityData ?? []);
} else {
  setLocation(null);
  setActivity([]);
}

setLoading(false);
}

  async function handleUpdateQuantity(inventoryId: string, quantity: number) {
  if (quantity < 0) return;

  try {
    const res = await fetch("/api/locations/update-quantity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inventoryId,
        quantity,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result?.error || "Kunne ikke oppdatere antall");
    }

    await loadLocation();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunne ikke oppdatere antall";

    alert(message);
  }
}

  async function handleRemoveInventory(inventoryId: string) {
  const confirmed = window.confirm("Fjerne produktet fra denne lokasjonen?");
  if (!confirmed) return;

  try {
    const res = await fetch("/api/locations/remove-product", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inventoryId,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result?.error || "Kunne ikke fjerne produkt");
    }

    await loadLocation();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunne ikke fjerne produkt";

    alert(message);
  }
}

  async function handleAddProductToLocation() {
  if (!location || saving) return;

  const sku = skuInput.trim();
  const quantity = Number(quantityInput);

  if (!sku) {
    alert("Skriv inn SKU");
    return;
  }

  if (Number.isNaN(quantity) || quantity < 0) {
    alert("Antall må være 0 eller høyere");
    return;
  }

  setSaving(true);

  try {
    const res = await fetch("/api/locations/add-product", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locationId: location.id,
        locationCode: location.code,
        sku,
        quantity,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result?.error || "Kunne ikke legge til produkt");
    }

    setSkuInput("");
    setQuantityInput("1");

    await loadLocation();

    setTimeout(() => {
      document.getElementById("location-sku-input")?.focus();
    }, 50);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunne ikke legge til produkt";

    alert(message);
  } finally {
    setSaving(false);
  }
}

 

 

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
          <SnakeHero
  eyebrow="Snake / Lokasjon"
  title={loading ? "Laster..." : location?.code ?? "Ikke funnet"}
  description="Bruk denne siden etter QR-scan for å se, justere og registrere varer på lokasjonen."
  backHref="/locations"
  backLabel="Tilbake til lokasjoner"
  right={
    location ? (
      <div className="grid grid-cols-2 overflow-hidden rounded-3xl border border-white/10 bg-black/10">
        <div className="border-r border-white/10 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Status
          </p>

          <p className="mt-1 text-lg font-semibold text-white">
            {location.active ? "Aktiv" : "Inaktiv"}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Antall totalt
          </p>

          <p className="mt-1 text-lg font-semibold text-white">
            {totalQuantity}
          </p>
        </div>
      </div>
    ) : undefined
  }
/>

          <div className="bg-[#f6f7f8] px-5 py-5 sm:px-8 sm:py-6">
            {loading ? (
              <InfoBox text="Laster lokasjon..." />
            ) : !location ? (
              <InfoBox text={`Fant ingen lokasjon med kode: ${code}`} />
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard label="Lokasjon" value={location.code} icon={<MapPin />} tone="blue" />
                <InfoCard
                  label="Sone"
                  value={
                    location.zones
                      ? `${location.zones.code} — ${location.zones.name}`
                      : "Mangler sone"
                  }
                  icon={<MapPin />}
                  tone="gold"
                />
                <InfoCard
                  label="Produkter"
                  value={String(inventoryItems.length)}
                  icon={<Package />}
                  tone="neutral"
                />
              </div>
            )}
          </div>

            {location && (
  <div className="mt-5 flex flex-wrap gap-2">
    {isEmpty && <LocationBadge tone="neutral" text="Tom" />}
    {!isEmpty && <LocationBadge tone="ok" text="Aktiv" />}
    {missingZone && <LocationBadge tone="warn" text="Mangler sone" />}
    {isHighLoad && <LocationBadge tone="warn" text="Høy belastning" />}
    {recentlyChanged && <LocationBadge tone="blue" text="Nylig endret" />}
  </div>
)}

          {location && (
            <div className="grid gap-6 border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7 lg:grid-cols-[0.95fr_1.05fr]">
                 {canWrite && (
              <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                    Legg til produkt
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Søk med SKU og legg produktet på denne lokasjonen.
                  </p>
                </div>

                <div className="space-y-4 p-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      SKU
                    </label>
                    <input
                      id="location-sku-input"
                      autoFocus
                      value={skuInput}
                      onChange={(e) => setSkuInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddProductToLocation();
                        }
                      }}
                      placeholder="f.eks. KEU-001"
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Antall
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value)}
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
                    />
                  </div>

                  <button
                    onClick={handleAddProductToLocation}
                    disabled={saving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#055a7d] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {saving ? "Lagrer..." : "Legg til på lokasjon"}
                  </button>
                </div>
              </section>
              )}

              <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                    Produkter på lokasjon
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {inventoryItems.length} registrerte produkter
                  </p>
                </div>

                {inventoryItems.length === 0 ? (
                  <div className="px-6 py-10 text-sm text-neutral-500">
                    Ingen produkter er registrert på denne lokasjonen.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {inventoryItems.map((item) => (
                      <InventoryRow
                        key={item.id}
                        item={item}
                        canWrite={canWrite}
                        onUpdateQuantity={(quantity) =>
                          handleUpdateQuantity(item.id, quantity)
                        }
                        onRemove={() => handleRemoveInventory(item.id)}
                      />
                    ))}
                  </div>
                )}
                

{location && (
            <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7">
              <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                    Lokasjonshistorikk
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Siste hendelser registrert på denne lokasjonen.
                  </p>
                </div>

                {activity.length === 0 ? (
                  <div className="px-6 py-10 text-sm text-neutral-500">
                    Ingen historikk registrert på denne lokasjonen.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {activity.map((item) => (
                      <ActivityItemCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
              </section>
            </div>
          )}
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
}

function LocationBadge({
  text,
  tone,
}: {
  text: string;
  tone: "ok" | "warn" | "blue" | "neutral";
}) {
  const styles = {
    ok: "border-emerald-300/30 bg-emerald-300/15 text-emerald-50",
    warn: "border-[#b58a14]/40 bg-[#b58a14]/20 text-[#ffe1a1]",
    blue: "border-white/20 bg-white/10 text-white",
    neutral: "border-white/15 bg-white/8 text-white/75",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {text}
    </span>
  );
}
function InventoryRow({
  item,
  canWrite,
  onUpdateQuantity,
  onRemove,
}: {
  item: LocationDetail["inventory"][number];
  canWrite: boolean;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const [localQuantity, setLocalQuantity] = useState(String(item.quantity ?? 0));

  return (
    <div className="px-6 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-neutral-950">
            {item.products?.sku || "Mangler SKU"}
          </p>

          {item.products?.id ? (
            <Link
              href={`/products/${item.products.id}`}
              className="mt-1 block text-sm font-semibold text-[#055a7d] underline-offset-4 hover:underline"
            >
              {item.products.product_name}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-neutral-700">Ukjent produkt</p>
          )}

          {item.products?.variant_name && (
            <p className="mt-1 text-sm text-neutral-500">
              {item.products.variant_name}
            </p>
          )}
        </div>

          {canWrite && (
        <button
          onClick={onRemove}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          <Trash2 className="h-4 w-4" />
          Fjern
        </button>
        )}
      </div>
      
        {canWrite && (
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <input
          type="number"
          min="0"
          value={localQuantity}
          onChange={(e) => setLocalQuantity(e.target.value)}
          className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
        />

        <button
          onClick={() => {
            const quantity = Number(localQuantity);
            if (Number.isNaN(quantity) || quantity < 0) return;
            onUpdateQuantity(quantity);
          }}
          className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white"
        >
          Lagre
        </button>
      </div>
      )}
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-5 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/55">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function InfoBox({ text }: { text: string }) {
  return <div className="rounded-2xl bg-white p-6 text-sm text-neutral-500">{text}</div>;
}

function InfoCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "blue" | "gold" | "neutral";
}) {
  const styles = {
    blue: "border-t-[#055a7d] text-[#055a7d]",
    gold: "border-t-[#a77e05] text-[#a77e05]",
    neutral: "border-t-neutral-300 text-neutral-500",
  };

  return (
    <div
      className={`rounded-2xl border border-neutral-200 border-t-4 bg-white p-5 shadow-sm ${styles[tone]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {label}
          </p>
          <p className="mt-3 text-lg font-semibold text-neutral-950">{value}</p>
        </div>

        <div className="[&>svg]:h-6 [&>svg]:w-6">{icon}</div>
      </div>
    </div>
  );
}
