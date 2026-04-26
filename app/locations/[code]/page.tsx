"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Package, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../../components/SnakeNav";
import SnakeFooter from "../../components/SnakeFooter";

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

export default function LocationDetailPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? "");

  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [skuInput, setSkuInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (code) loadLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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
    } else {
      setLocation((data as unknown as LocationDetail) ?? null);
    }

    setLoading(false);
  }

  async function handleUpdateQuantity(inventoryId: string, quantity: number) {
    if (quantity < 0) return;

    const { error } = await supabase
      .from("inventory")
      .update({ quantity })
      .eq("id", inventoryId);

    if (error) {
      alert(`Kunne ikke oppdatere antall: ${error.message}`);
      return;
    }

    await loadLocation();
  }

  async function handleRemoveInventory(inventoryId: string) {
    const confirmed = window.confirm("Fjerne produktet fra denne lokasjonen?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("inventory")
      .delete()
      .eq("id", inventoryId);

    if (error) {
      alert(`Kunne ikke fjerne produkt: ${error.message}`);
      return;
    }

    await loadLocation();
  }

  async function handleAddProductToLocation() {
    if (!location) return;

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

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, sku, product_name")
      .ilike("sku", sku)
      .maybeSingle();

    if (productError) {
      setSaving(false);
      alert(`Kunne ikke finne produkt: ${productError.message}`);
      return;
    }

    if (!product) {
      setSaving(false);
      alert(`Fant ingen produkt med SKU: ${sku}`);
      return;
    }

    const { data: existingInventory, error: existingError } = await supabase
      .from("inventory")
      .select("id, quantity")
      .eq("product_id", product.id)
      .eq("location_id", location.id)
      .maybeSingle();

    if (existingError) {
      setSaving(false);
      alert(`Kunne ikke sjekke eksisterende lagerlinje: ${existingError.message}`);
      return;
    }

    const { error } = existingInventory
      ? await supabase
          .from("inventory")
          .update({
            quantity: (existingInventory.quantity ?? 0) + quantity,
          })
          .eq("id", existingInventory.id)
      : await supabase.from("inventory").insert({
          product_id: product.id,
          location_id: location.id,
          quantity,
          is_primary: false,
        });

    setSaving(false);

    if (error) {
      alert(`Kunne ikke legge til produkt: ${error.message}`);
      return;
    }

    setSkuInput("");
    setQuantityInput("1");
    await loadLocation();
  }

  const totalQuantity =
    location?.inventory?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ??
    0;

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
          <div className="bg-gradient-to-br from-[#055a7d] to-[#042834] px-5 py-7 text-white sm:px-10 sm:py-10">
            <Link
              href="/locations"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/75 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake til lokasjoner
            </Link>

            <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">
                  SNAKE / Lokasjon
                </p>

                <h1 className="mt-3 text-4xl font-semibold leading-[0.95] tracking-tight sm:text-5xl">
                  {loading ? "Laster..." : location?.code ?? "Ikke funnet"}
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
                  Bruk denne siden etter QR-scan for å se, justere og registrere
                  varer på lokasjonen.
                </p>
              </div>

              {location && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <HeroStat label="Status" value={location.active ? "Aktiv" : "Inaktiv"} />
                  <HeroStat label="Antall totalt" value={String(totalQuantity)} />
                </div>
              )}
            </div>
          </div>

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
                  value={String(location.inventory?.length ?? 0)}
                  icon={<Package />}
                  tone="neutral"
                />
              </div>
            )}
          </div>

          {location && (
            <div className="grid gap-6 border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7 lg:grid-cols-[0.95fr_1.05fr]">
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
                      value={skuInput}
                      onChange={(e) => setSkuInput(e.target.value)}
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

              <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                    Produkter på lokasjon
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {location.inventory?.length ?? 0} registrerte produkter
                  </p>
                </div>

                {location.inventory.length === 0 ? (
                  <div className="px-6 py-10 text-sm text-neutral-500">
                    Ingen produkter er registrert på denne lokasjonen.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {location.inventory.map((item) => (
                      <InventoryRow
                        key={item.id}
                        item={item}
                        onUpdateQuantity={(quantity) =>
                          handleUpdateQuantity(item.id, quantity)
                        }
                        onRemove={() => handleRemoveInventory(item.id)}
                      />
                    ))}
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

function InventoryRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: LocationDetail["inventory"][number];
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
          <p className="mt-1 text-sm text-neutral-700">
            {item.products?.product_name ?? "Ukjent produkt"}
          </p>
          {item.products?.variant_name && (
            <p className="mt-1 text-sm text-neutral-500">
              {item.products.variant_name}
            </p>
          )}
        </div>

        <button
          onClick={onRemove}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          <Trash2 className="h-4 w-4" />
          Fjern
        </button>
      </div>

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