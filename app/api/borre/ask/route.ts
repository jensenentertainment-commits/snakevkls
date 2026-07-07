import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/dashboard";
import { getWarehouseHealth } from "@/lib/intelligence/snake-intelligence";
import { getBorreChatSystemPrompt } from "@/lib/intelligence/borre/chat-system";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }

const { question, page, history = [] } = await req.json();



  if (!question || typeof question !== "string") {
    return NextResponse.json(
      { error: "Mangler spørsmål" },
      { status: 400 }
    );
  }



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

  const { data: missingLocationProducts } = await supabase
  .from("inventory")
  .select(`
    id,
    quantity,
    products (
      id,
      title,
      sku
    )
  `)
  .is("location_id", null)
  .limit(10);

const { data: missingInventoryRows } = await supabase
  .from("inventory")
  .select("id, product_id, quantity")
  .is("location_id", null)
  .limit(10);

const productIds =
  missingInventoryRows?.map((row) => row.product_id).filter(Boolean) ?? [];


const { data: missingLocationProductRows } =
  productIds.length > 0
    ? await supabase
        .from("products")
        .select("id, product_name, sku")
        .in("id", productIds)
    : { data: [] };

const missingLocationProductsText =
  missingInventoryRows && missingInventoryRows.length > 0
    ? missingInventoryRows
        .map((item, index) => {
          const product = missingLocationProductRows?.find(
            (p) => p.id === item.product_id
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

const system = getBorreChatSystemPrompt();

const latestSync = stats.latestShopifySync as any;
const meta = latestSync?.metadata ?? {};

const durationText =
  typeof meta.duration_ms === "number"
    ? `${meta.duration_ms} ms (~${Math.floor(meta.duration_ms / 60000)}m ${Math.round((meta.duration_ms % 60000) / 1000)}s)`
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

  


  const context = `
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
`;

const conversation = Array.isArray(history)
  ? history
      .slice(-8)
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.text === "string"
      )
      .map((m) => ({
        role: m.role,
        content: m.text,
      }))
  : [];

  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
  { role: "system", content: system },
  {
    role: "user",
    content: `Dette er nåværende Snake-kontekst:\n${context}`,
  },
  ...conversation,
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
}