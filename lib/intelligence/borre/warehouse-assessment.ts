import OpenAI from "openai";
import { getDashboardStats } from "@/lib/dashboard";
import { getWarehouseHealth } from "@/lib/intelligence/snake-intelligence";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getBorreWarehouseAssessment() {
  const stats = await getDashboardStats();

  const health = getWarehouseHealth({
    missingLocationCount: stats.missingLocationCount,
    quantityDiffCount: stats.quantityDiffCount,
    locationsWithoutZoneCount: stats.locationsNoZoneCount,
    placedCount: stats.placedProductCount,
  });

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
  };

  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "system",
        content: `
Du er Børre, lagerassistenten i Snake OS.

Du skriver Børres vurdering på lagersiden.
Svar på norsk.

Oppgave:
Gi en konkret vurdering av dagens viktigste lageroppgave.

Regler:
- Maks 3 setninger.
- Ikke start med "Børre sier".
- Ikke omtale deg selv som AI.
- Ikke omtale Snake som en slange.
- Ikke rams opp alle tall.
- Velg den viktigste lageroppgaven.
- Forklar kort hvorfor den bør prioriteres.
- Avslutt med én konkret anbefaling.
- Ikke finn opp data.
- Svar som en rolig lagerkollega.
`,
      },
      {
        role: "user",
        content: `Snake lagerdata:\n${JSON.stringify(context, null, 2)}`,
      },
    ],
  });

  return {
    message:
      response.output_text?.trim() ||
      "Børre har oversikt, men fikk ikke formulert lagervurderingen akkurat nå.",
    stats,
    health,
  };
}