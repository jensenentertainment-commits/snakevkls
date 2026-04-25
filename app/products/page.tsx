"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";

type ProductRow = {
  id: string;
  sku: string | null;
  product_name: string;
  variant_name: string | null;
  active: boolean;
  inventory: {
    id: string;
    quantity: number;
    is_primary: boolean;
    locations: {
      id: string;
      code: string;
    } | null;
  }[];
};

type LocationOption = {
  id: string;
  code: string;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [newLocation, setNewLocation] = useState("");
const [newQuantity, setNewQuantity] = useState("0");

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const [productsRes, locationsRes] = await Promise.all([
        supabase
          .from("products")
          .select(`
            id,
            sku,
            product_name,
            variant_name,
            active,
            inventory (
              id,
              quantity,
              is_primary,
              locations (
                id,
                code
              )
            )
          `)
          .order("product_name", { ascending: true }),

        supabase
          .from("locations")
          .select("id, code")
          .eq("active", true)
          .order("code", { ascending: true }),
      ]);

      if (productsRes.error) {
        console.error("Feil ved henting av produkter:", productsRes.error);
        setProducts([]);
      } else {
        setProducts((productsRes.data as unknown as ProductRow[]) ?? []);
      }

      if (locationsRes.error) {
        console.error("Feil ved henting av lokasjoner:", locationsRes.error);
        setLocations([]);
      } else {
        setLocations((locationsRes.data as LocationOption[]) ?? []);
      }

      setLoading(false);
    }

    loadData();
  }, []);

 async function handleSaveLocation() {
  if (!editing || !newLocation) return;

  const quantity = Number(newQuantity);
  if (Number.isNaN(quantity) || quantity < 0) return;

  const existingInventory = editing.inventory?.[0];

  const { error } = existingInventory
    ? await supabase
        .from("inventory")
        .update({
          location_id: newLocation,
          quantity,
        })
        .eq("id", existingInventory.id)
    : await supabase.from("inventory").insert({
        product_id: editing.id,
        location_id: newLocation,
        quantity,
        is_primary: true,
      });

  if (error) {
    console.error("Feil ved lagring av inventory:", error);
    return;
  }

  setEditing(null);
  setNewLocation("");
  setNewQuantity("0");
  window.location.reload();
}

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;

    return products.filter((product) => {
      const searchable = [
        product.sku ?? "",
        product.product_name ?? "",
        product.variant_name ?? "",
        ...(product.inventory?.map((inv) => inv.locations?.code ?? "") ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [products, query]);

  const missingLocationCount = products.filter(
    (p) => !p.inventory || p.inventory.length === 0
  ).length;

  const multiLocationCount = products.filter(
    (p) => (p.inventory?.length ?? 0) > 1
  ).length;

  const okCount = products.length - missingLocationCount - multiLocationCount;

  return (
    <>
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
                  Søk på SKU, produktnavn, variant eller lokasjon. Endre
                  plassering direkte når varen mangler fast lagerplass.
                </p>
              </div>

              <div className="w-full lg:w-[420px]">
                <label
                  htmlFor="product-search"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/60"
                >
                  Søk
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="product-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="SKU, produktnavn eller lokasjon"
                    className="w-full rounded-2xl border border-white/20 bg-white px-12 py-4 text-base text-neutral-950 shadow-lg outline-none transition focus:border-[#b58a14] sm:py-3.5 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 bg-[#f6f7f8] px-5 py-5 sm:grid-cols-2 sm:px-8 sm:py-6 lg:grid-cols-4">
              <StatCard icon={<Layers />} label="Totale" value={products.length} tone="blue" />
              <StatCard icon={<CheckCircle2 />} label="OK" value={okCount} tone="ok" />
              <StatCard icon={<AlertTriangle />} label="Uten lokasjon" value={missingLocationCount} tone="gold" />
              <StatCard icon={<MapPin />} label="Flere lokasjoner" value={multiLocationCount} tone="neutral" />
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
                        : `${filteredProducts.length} av ${products.length} produkter vises`}
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

                {/* Mobil / nettbrett */}
                <div className="divide-y divide-neutral-100 lg:hidden">
                  {loading ? (
                    <MobileEmpty text="Laster produkter..." />
                  ) : filteredProducts.length === 0 ? (
                    <MobileEmpty text="Ingen treff." />
                  ) : (
                    filteredProducts.map((product) => (
                      <MobileProductCard
                        key={product.id}
                        product={product}
                        onEdit={() => {
                          setEditing(product);
                          setNewLocation(product.inventory?.[0]?.locations?.id ?? "");
                        }}
                      />
                    ))
                  )}
                </div>

                {/* Desktop */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-white text-left text-xs uppercase tracking-[0.14em] text-neutral-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">SKU</th>
                        <th className="px-5 py-4 font-semibold">Produkt</th>
                        <th className="px-5 py-4 font-semibold">Variant</th>
                        <th className="px-5 py-4 font-semibold">Lokasjon</th>
                        <th className="px-5 py-4 font-semibold">Antall</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Handling</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <EmptyRow text="Laster produkter..." />
                      ) : filteredProducts.length === 0 ? (
                        <EmptyRow text="Ingen treff." />
                      ) : (
                        filteredProducts.map((product) => {
                          const parsed = getProductMeta(product);

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

                              <td className="max-w-[360px] px-5 py-5 text-sm text-neutral-900">
                                {product.product_name}
                              </td>

                              <td className="px-5 py-5 text-sm text-neutral-500">
                                {product.variant_name || "—"}
                              </td>

                              <td className="px-5 py-5 text-sm">
                                <LocationDisplay codes={parsed.locationCodes} />
                              </td>

                              <td className="px-5 py-5 text-sm font-medium text-neutral-800">
                                {parsed.totalQuantity}
                              </td>

                              <td className="px-5 py-5 text-sm">
                                <ProductStatus
                                  hasLocation={parsed.hasLocation}
                                  multiLocation={parsed.multiLocation}
                                />
                              </td>

                              <td className="px-5 py-5 text-sm">
                                <button
                                  onClick={() => {
                                    setEditing(product);
                                    setNewLocation(
                                      product.inventory?.[0]?.locations?.id ?? ""
                                    );
                                  }}
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
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-3xl bg-white p-6 text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
              Endre lokasjon
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {editing.sku || "Produkt uten SKU"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {editing.product_name}
            </p>

            <select
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="mt-6 w-full rounded-2xl border border-neutral-300 px-4 py-4 text-base text-neutral-900 outline-none transition focus:border-[#055a7d] sm:py-3 sm:text-sm"
            >
              <option value="">Velg lokasjon</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code}
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
  className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-4 text-base text-neutral-900 outline-none transition focus:border-[#055a7d] sm:py-3 sm:text-sm"
/>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setEditing(null);
                  setNewLocation("");
                  setNewQuantity("0");
                }}
                className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveLocation}
                className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getProductMeta(product: ProductRow) {
  const locationCodes =
    product.inventory?.map((inv) => inv.locations?.code).filter(Boolean) ?? [];

  const totalQuantity =
    product.inventory?.reduce((sum, inv) => sum + (inv.quantity ?? 0), 0) ?? 0;

  const hasLocation = locationCodes.length > 0;
  const multiLocation = locationCodes.length > 1;

  return { locationCodes, totalQuantity, hasLocation, multiLocation };
}

function MobileProductCard({
  product,
  onEdit,
}: {
  product: ProductRow;
  onEdit: () => void;
}) {
  const parsed = getProductMeta(product);

  return (
    <article className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950">
            {product.sku || <span className="text-red-600">Mangler SKU</span>}
          </p>
          <h3 className="mt-1 text-base font-semibold leading-6 text-neutral-900">
            {product.product_name}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            {product.variant_name || "Ingen variant"}
          </p>
        </div>

        <ProductStatus
          hasLocation={parsed.hasLocation}
          multiLocation={parsed.multiLocation}
        />
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-neutral-50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Lokasjon
          </p>
          <div className="mt-2">
            <LocationDisplay codes={parsed.locationCodes} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
          <span className="text-sm text-neutral-500">Antall</span>
          <span className="text-base font-semibold text-neutral-950">
            {parsed.totalQuantity}
          </span>
        </div>
      </div>

      <button
        onClick={onEdit}
        className="mt-4 w-full rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white"
      >
        Endre lokasjon
      </button>
    </article>
  );
}

function LocationDisplay({ codes }: { codes: (string | undefined)[] }) {
  const cleanCodes = codes.filter(Boolean) as string[];

  if (cleanCodes.length === 0) {
    return <span className="font-semibold text-[#a77e05]">Mangler lokasjon</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {cleanCodes.map((code) => (
        <span
          key={code}
          className="rounded-lg border border-[#055a7d]/20 bg-[#055a7d]/5 px-2 py-1 text-xs font-semibold text-[#055a7d]"
        >
          {code}
        </span>
      ))}
    </div>
  );
}

function ProductStatus({
  hasLocation,
  multiLocation,
}: {
  hasLocation: boolean;
  multiLocation: boolean;
}) {
  if (!hasLocation) {
    return <StatusPill text="Trenger lokasjon" tone="danger" />;
  }

  if (multiLocation) {
    return <StatusPill text="Flere lokasjoner" tone="warning" />;
  }

  return <StatusPill text="OK" tone="ok" />;
}

function MobileEmpty({ text }: { text: string }) {
  return <div className="px-5 py-10 text-sm text-neutral-500">{text}</div>;
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={7} className="px-5 py-12 text-sm text-neutral-500">
        {text}
      </td>
    </tr>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "blue" | "gold" | "neutral" | "ok";
}) {
  const styles = {
    blue: "border-t-[#055a7d] text-[#055a7d]",
    gold: "border-t-[#a77e05] text-[#a77e05]",
    neutral: "border-t-neutral-300 text-neutral-500",
    ok: "border-t-emerald-500 text-emerald-600",
  };

  return (
    <div
      className={`rounded-2xl border border-neutral-200 border-t-4 bg-white p-4 shadow-sm sm:p-5 ${styles[tone]}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 sm:mt-3 sm:text-3xl">
            {value}
          </p>
        </div>

        <div className="[&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6">
          {icon}
        </div>
      </div>
    </div>
  );
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