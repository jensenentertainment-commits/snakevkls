"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../../components/SnakeNav";
import SnakeFooter from "../../components/SnakeFooter";

export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

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
            code
          )
        )
      `)
      .eq("id", id)
      .single();

    setProduct(data);

    const { data: activityData } = await supabase
      .from("activity_log")
      .select(`
        id,
        action,
        title,
        description,
        metadata,
        created_at
      `)
      .contains("metadata", { product_id: id })
      .order("created_at", { ascending: false })
      .limit(20);

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
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
          <div className="bg-gradient-to-br from-[#055a7d] to-[#042834] px-5 py-8 text-white sm:px-8 lg:px-10">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Til produkter
            </Link>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_220px] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                  Produkt
                </p>

                <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight tracking-tight">
                  {product.product_name}
                </h1>

                {product.variant_name && (
                  <p className="mt-2 text-sm text-white/65">
                    {product.variant_name}
                  </p>
                )}
              </div>

              {product.image_url && (
                <div className="h-40 w-40 overflow-hidden rounded-3xl border border-white/15 bg-white/10">
                  <img
                    src={product.image_url}
                    alt={product.product_name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

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

          <div className="grid gap-5 border-t border-neutral-200 bg-neutral-50 px-5 py-6 sm:px-8 lg:grid-cols-2">
            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
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

            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
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
                    <div
                      key={item.id}
                      className="rounded-2xl border border-neutral-200 p-4"
                    >
                      <p className="font-semibold">{item.title}</p>

                      {item.description && (
                        <p className="mt-1 text-sm text-neutral-600">
                          {item.description}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-neutral-400">
                        {new Date(item.created_at).toLocaleString("nb-NO")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>

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
    neutral: "bg-white text-neutral-950",
    ok: "bg-green-50 text-green-700",
    warn: "bg-[#fbf6e8] text-[#a77e05]",
  }[tone];

  return (
    <div className={`rounded-2xl border border-neutral-200 p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-60">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}