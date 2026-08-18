import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getDashboardStats } from "@/lib/dashboard";
import { getBorreChatSystemPrompt } from "@/lib/intelligence/borre/chat-system";
import { buildSnakeKnowledgePrompt } from "@/lib/intelligence/shared/build-snake-knowledge";
import { validateChatInput } from "@/lib/intelligence/shared/chat-input";
import {
  CHAT_MODEL,
  chatInputError,
  chatServerError,
  getChatOpenAIClient,
  logChatServerError,
} from "@/lib/intelligence/shared/chat-server";
import { getWarehouseHealth } from "@/lib/intelligence/snake-intelligence";

type AuthClient = Extract<
  Awaited<ReturnType<typeof requireRole>>,
  { ok: true }
>["authClient"];

type LatestSync = {
  id?: string | null;
  title?: string | null;
  action?: string | null;
  created_at?: string | null;
  metadata?: {
    duration_ms?: number;
    imported?: number;
    skipped_no_sku?: number;
    collections_linked?: number;
    source?: string;
  } | null;
};

export async function POST(req: Request) {
  try {
    const auth = await requireRole(["admin", "lager"]);
    if (!auth.ok) return auth.response;

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return chatInputError("Forespørselen må inneholde gyldig JSON.");
    }

    const input = validateChatInput(body);
    if (!input.ok) return chatInputError(input.error);

    const { question, page, history } = input.value;
    let promptContext: Awaited<ReturnType<typeof buildBorrePromptContext>>;

    try {
      promptContext = await buildBorrePromptContext(auth.authClient, page);
    } catch (error) {
      logChatServerError("borre", "context", error);
      return chatServerError();
    }

    try {
      const response = await getChatOpenAIClient().responses.create({
        model: CHAT_MODEL,
        input: [
          { role: "system", content: getBorreChatSystemPrompt() },
          {
            role: "user",
            content: `
Dette er bakgrunnsinformasjon om Snake.
Den skal bare brukes når den er relevant for brukerens spørsmål.
Ikke analyser eller foreslå tiltak utelukkende fordi informasjonen finnes her.

=== Snake Knowledge ===

${promptContext.snakeKnowledge}

=== Operational Context ===

${promptContext.context}
`,
          },
          ...history.map((message) => ({
            role: message.role,
            content: message.text,
          })),
          {
            role: "user",
            content: question,
          },
        ],
      });

      return NextResponse.json({
        answer:
          response.output_text ||
          "Børre fikk ikke svart. Det er sjeldent, men tydeligvis mulig.",
      });
    } catch (error) {
      logChatServerError("borre", "openai", error);
      return chatServerError();
    }
  } catch (error) {
    logChatServerError("borre", "unexpected", error);
    return chatServerError();
  }
}

async function buildBorrePromptContext(
  authClient: AuthClient,
  page: string | null
) {
  const snakeKnowledge = buildSnakeKnowledgePrompt();
  const stats = await getDashboardStats();
  const {
    missingLocationCount,
    missingSkuCount,
    emptyLocationCount,
    quantityDiffCount,
    placedProductCount,
    activeProductCount,
    locationsNoZoneCount,
    latestShopifySync,
  } = stats;

  const { data: missingInventoryRows, error: inventoryError } = await authClient
    .from("inventory")
    .select("id, product_id, quantity")
    .is("location_id", null)
    .limit(10);

  if (inventoryError) {
    throw new Error(`Missing inventory query failed: ${inventoryError.message}`);
  }

  const productIds =
    missingInventoryRows?.map((row) => row.product_id).filter(Boolean) ?? [];

  const { data: missingLocationProductRows, error: productsError } =
    productIds.length > 0
      ? await authClient
          .from("products")
          .select("id, product_name, sku")
          .in("id", productIds)
      : { data: [], error: null };

  if (productsError) {
    throw new Error(`Missing products query failed: ${productsError.message}`);
  }

  const missingLocationProductsText =
    missingInventoryRows && missingInventoryRows.length > 0
      ? missingInventoryRows
          .map((item, index) => {
            const product = missingLocationProductRows?.find(
              (candidate) => candidate.id === item.product_id
            );

            return `${index + 1}. ${product?.product_name ?? "Ukjent produkt"} — SKU: ${
              product?.sku ?? "mangler"
            } — Antall i Snake: ${item.quantity ?? 0}`;
          })
          .join("\n")
      : "Ingen produkter hentet.";

  const health = getWarehouseHealth({
    missingLocationCount,
    quantityDiffCount,
    locationsWithoutZoneCount: locationsNoZoneCount,
    placedCount: placedProductCount,
  });

  const recommendedAction =
    quantityDiffCount > 0
      ? `Rydd quantity diff først (${quantityDiffCount} produkter).`
      : missingLocationCount > 0
        ? `Sett lokasjon på produkter uten plassering (${missingLocationCount} produkter).`
        : locationsNoZoneCount > 0
          ? `Rydd lokasjoner uten sone (${locationsNoZoneCount}).`
          : missingSkuCount > 0
            ? `Rydd produkter uten SKU (${missingSkuCount}).`
            : emptyLocationCount > 0
              ? `Kontroller tomme lokasjoner (${emptyLocationCount}).`
              : "Ingen kritiske lageroppgaver akkurat nå.";

  const latestSync = latestShopifySync as LatestSync | null;
  const meta = latestSync?.metadata ?? {};
  const durationText =
    typeof meta.duration_ms === "number"
      ? `${meta.duration_ms} ms (~${Math.floor(meta.duration_ms / 60000)}m ${Math.round(
          (meta.duration_ms % 60000) / 1000
        )}s)`
      : "ukjent";
  const shopifySyncText = latestSync
    ? `
Status: ${latestSync.title ?? "ukjent"} (${latestSync.action ?? "ukjent"})
Tidspunkt: ${latestSync.created_at ?? "ukjent"}
Sync-ID: ${latestSync.id ?? "ukjent"}
Importerte produkter: ${meta.imported ?? "ukjent"}
Hoppet over pga. manglende SKU: ${meta.skipped_no_sku ?? "ukjent"}
Koblede collections: ${meta.collections_linked ?? "ukjent"}
Kjørt av: ${meta.source ?? "ukjent"}
Varighet: ${durationText}
`
    : "Børre mangler data om siste Shopify-sync.";

  return {
    snakeKnowledge,
    context: `
Snake-status:
- Aktive produkter: ${activeProductCount}
- Quantity diff: ${quantityDiffCount}
- Produkter uten lokasjon: ${missingLocationCount}
- Produkter uten SKU: ${missingSkuCount}
- Lokasjoner uten sone: ${locationsNoZoneCount}
- Tomme lokasjoner: ${emptyLocationCount}
- Plasserte produkter: ${placedProductCount}
- Snake Health: ${health.score}/100
- Snake Health nivå: ${health.level}
- Anbefalt første handling: ${recommendedAction}
- Nåværende side: ${page ?? "ukjent"}
- Siste Shopify-sync:
${shopifySyncText}
Produkter uten lokasjon, første 10:
${missingLocationProductsText}
`,
  };
}
