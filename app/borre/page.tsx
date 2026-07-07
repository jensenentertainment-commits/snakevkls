import AskBorre from "../components/AskBorre";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";
import { getDashboardStats } from "@/lib/dashboard";
import { getWarehouseHealth } from "@/lib/intelligence/snake-intelligence";

export const dynamic = "force-dynamic";

export default async function BorrePage() {
  const stats = await getDashboardStats();

  const health = getWarehouseHealth({
    missingLocationCount: stats.missingLocationCount,
    quantityDiffCount: stats.quantityDiffCount,
    locationsWithoutZoneCount: stats.locationsNoZoneCount,
    placedCount: stats.placedProductCount,
  });

  const observations = [
    `${stats.quantityDiffCount} produkter har quantity diff.`,
    `${stats.missingLocationCount} produkter mangler lokasjon.`,
    `${stats.locationsNoZoneCount} lokasjoner mangler sone.`,
    `Snake Health er ${health.score}/100 (${health.level}).`,
    `Siste Shopify-sync: ${
  stats.latestShopifySync
    ? JSON.stringify(stats.latestShopifySync)
    : "ukjent"
}.`
  ];

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#b58a14]">
            Snake Intelligence
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">
            Spør Børre
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            Er du i tvil, spør Børre. Her kan du spørre om lagerstatus,
            avvik, lokasjoner og hva som bør gjøres først.
          </p>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_380px]">
            <AskBorre mode="page" />

            <aside className="rounded-[26px] border border-white/10 bg-black/15 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b58a14]">
                Børres observasjoner
              </p>

              <div className="mt-4 space-y-3">
                {observations.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/65"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
}