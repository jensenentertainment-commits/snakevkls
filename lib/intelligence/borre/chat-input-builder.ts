import type { ChatMessage } from "../shared/chat-input";
import type { WarehouseSummaryContext } from "../workforce/contexts/warehouse-summary";

export type BorreModelMessage = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

export function buildBorreModelInput(input: {
  readonly systemPrompt: string;
  readonly context: WarehouseSummaryContext;
  readonly history: readonly ChatMessage[];
  readonly question: string;
}): BorreModelMessage[] {
  return [
    { role: "system", content: input.systemPrompt },
    {
      role: "user",
      content: `
Dette er bakgrunnsinformasjon om Snake.
Den skal bare brukes når den er relevant for brukerens spørsmål.
Ikke analyser eller foreslå tiltak utelukkende fordi informasjonen finnes her.

=== Snake Knowledge ===

${input.context.snakeKnowledge}

=== Operational Context ===

${formatBorreOperationalContext(input.context)}
`,
    },
    ...input.history.map((message) => ({
      role: message.role,
      content: message.text,
    })),
    { role: "user", content: input.question },
  ];
}

export function formatBorreOperationalContext(
  context: WarehouseSummaryContext
) {
  const sync = context.shopifySync;
  const durationText =
    typeof sync?.durationMs === "number"
      ? `${sync.durationMs} ms (~${Math.floor(sync.durationMs / 60000)}m ${Math.round(
          (sync.durationMs % 60000) / 1000
        )}s)`
      : "ukjent";
  const shopifySyncText = sync
    ? `
Status: ${sync.title ?? "ukjent"} (${sync.status ?? "ukjent"})
Tidspunkt: ${sync.createdAt ?? "ukjent"}
Sync-ID: ${sync.id ?? "ukjent"}
Importerte produkter: ${sync.imported ?? "ukjent"}
Hoppet over pga. manglende SKU: ${sync.skippedNoSku ?? "ukjent"}
Koblede collections: ${sync.collectionsLinked ?? "ukjent"}
Kjørt av: ${sync.source ?? "ukjent"}
Varighet: ${durationText}
`
    : "Børre mangler data om siste Shopify-sync.";
  const missingLocationProductsText =
    context.missingLocationProducts.length > 0
      ? context.missingLocationProducts
          .map(
            (product, index) =>
              `${index + 1}. ${product.productName} — SKU: ${product.sku ?? "mangler"} — Antall i Snake: ${product.quantity}`
          )
          .join("\n")
      : "Ingen produkter hentet.";

  return `
Snake-status:
- Aktive produkter: ${context.warehouse.activeProducts}
- Quantity diff: ${context.warehouse.quantityDiffs}
- Produkter uten lokasjon: ${context.warehouse.missingLocations}
- Produkter uten SKU: ${context.warehouse.missingSku}
- Lokasjoner uten sone: ${context.warehouse.locationsWithoutZone}
- Tomme lokasjoner: ${context.warehouse.emptyLocations}
- Plasserte produkter: ${context.warehouse.placedProducts}
- Snake Health: ${context.health.score}/100
- Snake Health nivå: ${context.health.level}
- Anbefalt første handling: ${context.recommendedAction}
- Nåværende side: ${context.page ?? "ukjent"}
- Siste Shopify-sync:
${shopifySyncText}
Produkter uten lokasjon, første 10:
${missingLocationProductsText}
`;
}
