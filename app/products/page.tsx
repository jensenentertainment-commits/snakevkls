"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";

type ProductRow = {
  id: string;
  sku: string | null;
  product_name: string;
  variant_name: string | null;
  image_url: string | null;
  vendor: string | null;
  product_type: string | null;
  shopify_quantity: number;
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

  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [newZone, setNewZone] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newQuantity, setNewQuantity] = useState("0");

  useEffect(() => {
    loadData();
  }, []);

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

  async function handleSave() {
    if (!editing) return;

    const quantity = Number(newQuantity);
    if (Number.isNaN(quantity) || quantity < 0) {
      alert("Antall må være 0 eller høyere");
      return;
    }

    const selectedLocation = locations.find((location) => location.id === newLocation);

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
      alert(`Kunne ikke lagre: ${error.message}`);
      return;
    }

    setEditing(null);
    setNewZone("");
    setNewLocation("");
    setNewQuantity("0");
    await loadData();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;

    return products.filter((product) => {
      const meta = getMeta(product);

      return [
        product.sku ?? "",
        product.product_name,
        product.variant_name ?? "",
        product.vendor ?? "",
        product.product_type ?? "",
        meta.locationCode ?? "",
        meta.zoneLabel ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [products, query]);

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
          <div className="grid gap-7 bg-gradient-to-br from-[#055a7d] to-[#042834] px-5 py-7 text-white sm:px-8 sm:py-9 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10 lg:py-10">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/65">
                SNAKE / Produkter
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-[0.95] tracking-tight sm:mt-4 sm:text-5xl">
                Varesøk
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:mt-5 sm:text-base sm:leading-7">
                Sett sone først, og nøyaktig lokasjon senere når lageret er ferdig
                merket.
              </p>
            </div>

            <div className="w-full lg:w-[420px]">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                Søk
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="SKU, produktnavn, sone eller lokasjon"
                  className="w-full rounded-2xl border border-white/20 bg-white px-12 py-4 text-base text-neutral-950 shadow-lg outline-none transition focus:border-[#b58a14] sm:py-3.5 sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
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
                      onEdit={() => openModal(product)}
                    />
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full border-collapse">
                  <thead className="bg-white text-left text-xs uppercase tracking-[0.14em] text-neutral-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">SKU</th>
                      <th className="px-5 py-4 font-semibold">Produkt</th>
                      <th className="px-5 py-4 font-semibold">Plassering</th>
                      <th className="px-5 py-4 font-semibold">Antall</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold">Handling</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-sm text-neutral-500">
                          Laster produkter...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-sm text-neutral-500">
                          Ingen treff.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((product) => {
                        const meta = getMeta(product);

                        return (
                          <tr
                            key={product.id}
                            className="border-t border-neutral-100 transition hover:bg-[#055a7d]/[0.025]"
                          >
                            <td className="px-5 py-5 text-sm font-semibold text-neutral-950">
                              {product.sku || (
                                <span className="text-red-600">Mangler SKU</span>
                              )}
                            </td>

                            <td className="max-w-[480px] px-5 py-5 text-sm text-neutral-900">
                              <ProductIdentity product={product} />
                            </td>

                            <td className="px-5 py-5 text-sm">
                              <PlacementDisplay meta={meta} />
                            </td>

                          
 <td className="px-5 py-5 text-sm font-medium text-neutral-800">
  <QuantityDiff product={product} meta={meta} />
</td>

                            <td className="px-5 py-5 text-sm">
                              <Status status={meta.status} />
                            </td>

                            <td className="px-5 py-5 text-sm">
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
                const location = locations.find((item) => item.id === locationId);

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
    </main>
  );

  function QuantityDiff({
  product,
  meta,
}: {
  product: ProductRow;
  meta: ReturnType<typeof getMeta>;
}) {
  const shopifyQuantity = product.shopify_quantity ?? 0;
  const snakeQuantity = meta.quantity ?? 0;
  const diff = shopifyQuantity - snakeQuantity;

  return (
    <div className="flex flex-col">
      <span className="font-semibold text-neutral-950">
        Snake: {snakeQuantity}
      </span>

      <span className="text-xs text-neutral-400">
        Shopify: {shopifyQuantity}
      </span>

      {diff > 0 && (
        <span className="mt-1 text-xs font-semibold text-[#a77e05]">
          {diff} ikke plassert
        </span>
      )}

      {diff < 0 && (
        <span className="mt-1 text-xs font-semibold text-red-600">
          {Math.abs(diff)} for mye i Snake
        </span>
      )}
    </div>
  );
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
}

type PlacementStatus = "location" | "zone" | "missing";

type ProductMeta = {
  quantity: number;
  locationCode: string | null;
  zoneLabel: string | null;
  status: PlacementStatus;
};

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
    status,
  };
}

function ProductIdentity({ product }: { product: ProductRow }) {
  return (
    <div className="flex items-center gap-4">
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

      <div className="min-w-0">
        <p className="font-semibold text-neutral-950">{product.product_name}</p>
        <p className="mt-1 text-xs text-neutral-500">
          {product.vendor || product.product_type || "Uten kategori"}
        </p>
        {product.variant_name && (
          <p className="mt-1 text-xs text-neutral-400">{product.variant_name}</p>
        )}
      </div>
    </div>
  );
}

function PlacementDisplay({ meta }: { meta: ReturnType<typeof getMeta> }) {
  if (meta.locationCode) {
    return (
      <span className="rounded-lg border border-[#055a7d]/20 bg-[#055a7d]/5 px-2 py-1 text-xs font-semibold text-[#055a7d]">
        {meta.locationCode}
      </span>
    );
  }

  if (meta.zoneLabel) {
    return (
      <span className="rounded-lg border border-[#a77e05]/20 bg-[#a77e05]/10 px-2 py-1 text-xs font-semibold text-[#a77e05]">
        {meta.zoneLabel}
      </span>
    );
  }

  return <span className="font-semibold text-red-600">Mangler plassering</span>;
}

function MobileProductCard({
  product,
  onEdit,
}: {
  product: ProductRow;
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

      <button
        onClick={onEdit}
        className="mt-4 w-full rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white"
      >
        Endre plassering
      </button>
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