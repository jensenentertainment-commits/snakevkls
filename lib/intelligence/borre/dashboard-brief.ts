import OpenAI from "openai";
import { getDashboardStats } from "@/lib/dashboard";
import { getWarehouseHealth } from "@/lib/intelligence/snake-intelligence";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getBorreDashboardBrief() {
  const stats = await getDashboardStats();

  const health = getWarehouseHealth({
    missingLocationCount: stats.missingLocationCount,
    quantityDiffCount: stats.quantityDiffCount,
    locationsWithoutZoneCount: stats.locationsNoZoneCount,
    placedCount: stats.placedProductCount,
  });

  const latestSync = stats.latestShopifySync as any;
  const meta = latestSync?.metadata ?? {};

  const context = {
    activeProducts: stats.activeProductCount,
    placedProducts: stats.placedProductCount,
    quantityDiffs: stats.quantityDiffCount,
    missingLocations: stats.missingLocationCount,
    missingSku: stats.missingSkuCount,
    emptyLocations: stats.emptyLocationCount,
    locationsWithoutZone: stats.locationsNoZoneCount,
    snakeHealth: health.score,
    snakeHealthLevel: health.level,
    latestShopifySync: latestSync
      ? {
          status: latestSync.action,
          time: latestSync.created_at,
          imported: meta.imported,
          skippedNoSku: meta.skipped_no_sku,
          collectionsLinked: meta.collections_linked,
          source: meta.source,
          durationMs: meta.duration_ms,
        }
      : null,
  };

  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "system",
        content: `
Du er Børre, lagerassistenten i Snake OS.

Du skriver én kort tekst til dashboardet etter innlogging.
Svar på norsk.

Regler:
- Maks 2 setninger.
- Ikke start med "Børre sier".
- Ikke omtale deg selv som AI.
- Ikke bruk metaforer om slanger.
- Ikke rams opp alle tall.
- Velg de 1–2 viktigste observasjonene.
- Bruk tall bare når de hjelper.
- Svar som en rolig lagerkollega.
- Avslutt gjerne med én konkret anbefaling.
- Ikke finn opp data.
`,
      },
      {
        role: "user",
        content: `Snake-data:\n${JSON.stringify(context, null, 2)}`,
      },
    ],
  });

  return {
    message:
      response.output_text?.trim() ||
      "Børre har oversikt, men fikk ikke formulert status akkurat nå.",
    stats,
    health,
  };
}