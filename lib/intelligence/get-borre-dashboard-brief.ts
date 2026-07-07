// lib/intelligence/get-borre-dashboard-brief.ts

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
  const syncMeta = latestSync?.metadata ?? {};

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
          imported: syncMeta.imported,
          skippedNoSku: syncMeta.skipped_no_sku,
          collectionsLinked: syncMeta.collections_linked,
          source: syncMeta.source,
          durationMs: syncMeta.duration_ms,
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
Skriv én kort dashboard-tekst til brukeren etter innlogging.
Svar på norsk.
Ikke skriv som chatbot.
Ikke start med "Børre sier".
Ikke finn opp data.
Maks 2 setninger.
Tone: rolig, praktisk, litt tørr humor hvis det passer.
Fokuser på hva som er viktigst akkurat nå.
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
      "Børre har oversikt, men fikk ikke formulert den pent akkurat nå.",
    stats,
    health,
  };
}