"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Package } from "lucide-react";
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

  useEffect(() => {
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

    if (code) loadLocation();
  }, [code]);

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
                  Skann QR-koden på hyllen for å åpne denne siden direkte og se
                  hva som ligger på lokasjonen.
                </p>
              </div>

              {location && (
                <div className="rounded-2xl bg-white/12 px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                    Status
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {location.active ? "Aktiv" : "Inaktiv"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#f6f7f8] px-5 py-5 sm:px-8 sm:py-6">
            {loading ? (
              <div className="rounded-2xl bg-white p-6 text-sm text-neutral-500">
                Laster lokasjon...
              </div>
            ) : !location ? (
              <div className="rounded-2xl bg-white p-6">
                <h2 className="text-xl font-semibold">Lokasjon ikke funnet</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Fant ingen lokasjon med kode: <strong>{code}</strong>
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard
                  label="Lokasjon"
                  value={location.code}
                  icon={<MapPin />}
                  tone="blue"
                />
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
            <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
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
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                      >
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

                        <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
                          <span className="text-neutral-500">Antall: </span>
                          <span className="font-semibold text-neutral-950">
                            {item.quantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
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
          <p className="mt-3 text-lg font-semibold text-neutral-950">
            {value}
          </p>
        </div>

        <div className="[&>svg]:h-6 [&>svg]:w-6">{icon}</div>
      </div>
    </div>
  );
}