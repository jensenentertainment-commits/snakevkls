import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getArneDevelopmentContext } from "../lib/intelligence/arne/development-context.ts";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Arne keeps the active admin-only HTTP and model contract", async () => {
  const [route, chatServer, ui, page] = await Promise.all([
    source("app/api/arne/ask/route.ts"),
    source("lib/intelligence/shared/chat-server.ts"),
    source("app/components/AskBorre.tsx"),
    source("app/arne/page.tsx"),
  ]);

  assert.match(route, /export async function POST\(req: Request\)/);
  assert.match(route, /requireRole\(\["admin"\]\)/);
  assert.match(route, /validateChatInput\(body\)/);
  assert.match(route, /model: CHAT_MODEL/);
  assert.match(route, /content: getArneSystemPrompt\(\)/);
  assert.match(route, /return NextResponse\.json\(\{[\s\S]*answer:/);
  assert.match(route, /Arne fikk ikke svart\. Det er irriterende, men teknisk mulig\./);
  assert.match(chatServer, /CHAT_MODEL = "gpt-5-mini"/);
  assert.match(ui, /const endpoint = isArne \? "\/api\/arne\/ask"/);
  assert.match(page, /profile\.role !== "admin"/);
  assert.doesNotMatch(route, /\btools\s*:|\btool_choice\s*:|\bfunction_call\s*:/);
});

test("Arne keeps the exact context blocks and model message order", async () => {
  const route = await source("app/api/arne/ask/route.ts");
  const systemIndex = route.indexOf("getArneSystemPrompt()");
  const knowledgeIndex = route.indexOf("=== Snake Knowledge ===");
  const developmentIndex = route.indexOf("=== Development Context ===");
  const operationalIndex = route.indexOf("=== Operational Context ===");
  const pageIndex = route.indexOf("=== Current Page ===");
  const historyIndex = route.indexOf("...conversation");
  const questionIndex = route.indexOf("content: question");

  assert.ok(systemIndex >= 0);
  assert.ok(knowledgeIndex > systemIndex);
  assert.ok(developmentIndex > knowledgeIndex);
  assert.ok(operationalIndex > developmentIndex);
  assert.ok(pageIndex > operationalIndex);
  assert.ok(historyIndex > pageIndex);
  assert.ok(questionIndex > historyIndex);
  assert.equal((route.match(/JSON\.stringify\([^)]*, null, 2\)/g) ?? []).length, 2);
  assert.match(route, /page \?\? "ukjent"/);
});

test("Arne keeps the existing development context unchanged", () => {
  assert.deepEqual(getArneDevelopmentContext(), {
    project: "Snake OS",
    purpose:
      "Internt lager- og driftssystem for Varekompaniet. Snake skal etter hvert flytte arbeidsflyt bort fra Shopify der det gir mening.",
    currentStatus: {
      phase: "Under utvikling",
      users: "Foreløpig hovedsakelig admin. Andre brukere skal først inn når Snake er klart.",
      mainFocus: "Regular Børre, lagerstatus og etter hvert ordre/plukk.",
    },
    currentModules: [
      "Dashboard", "Lager", "Produkter", "Lokasjoner", "Issues",
      "Activities", "Børre", "Viper", "Snake Labs", "Innstillinger",
    ],
    plannedModules: [
      "Ordre/plukk", "Kundeservice", "E-post i Snake",
      "Nettbutikk-chat koblet til Snake", "Arne",
    ],
    principles: [
      "Bygg små, ferdige steg.",
      "Ikke bygg funksjoner før behovet er tydelig.",
      "Snake skal føles rolig, praktisk og ryddig.",
      "Børre skal føles som en lagerassistent, ikke som en AI-chat.",
      "Regular Børre hjelper med drift. Arne hjelper med utvikling.",
      "Unngå store omskrivinger uten god grunn.",
    ],
    currentSprint: [
      "Rydde Børre-struktur i egne filer.",
      "Bruke felles Børre-context.",
      "Gjøre Regular Børre ferdig før Arne bygges fullt ut.",
    ],
    nextLikelyWork: [
      "Quantity diff-liste i Børre.",
      "Produkter uten SKU i Børre.",
      "Tomme lokasjoner i Børre.",
      "Sidebevissthet i Børre.",
      "Viper ordre/plukk.",
    ],
  });
});

test("Arne keeps the existing read-only operational context", async () => {
  const [operational, dashboard] = await Promise.all([
    source("lib/intelligence/shared/operational-context.ts"),
    source("lib/dashboard.ts"),
  ]);

  for (const field of [
    "stats", "health", "warehouse", "shopifySync",
    "missingLocationProducts",
  ]) {
    assert.match(operational, new RegExp(`\\b${field}\\b`));
  }
  assert.match(dashboard, /latestActivity/);
  assert.match(operational, /\.from\("inventory"\)/);
  assert.match(operational, /\.select\("product_id, quantity"\)/);
  assert.match(operational, /\.is\("location_id", null\)/);
  assert.match(operational, /\.limit\(10\)/);
  assert.match(operational, /\.from\("products"\)/);
  assert.match(operational, /\.select\("id, product_name, sku"\)/);
  assert.doesNotMatch(
    operational,
    /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/
  );
});

test("Arne keeps the existing UI suggestions and local history limit", async () => {
  const [ui, page] = await Promise.all([
    source("app/components/AskBorre.tsx"),
    source("app/arne/page.tsx"),
  ]);

  for (const suggestion of [
    "Hva bør vi prioritere nå?",
    "Ser du varige svakheter i Snake?",
    "Passer dagens roadmap fortsatt?",
    "Hva bør vi ikke bygge ennå?",
    "Har vi diskutert dette før?",
  ]) {
    assert.match(ui, new RegExp(suggestion.replace(/[?]/g, "\\?")));
  }
  assert.match(ui, /history: messages\.slice\(-8\)/);
  assert.match(page, /<AskBorre mode="page" variant="arne"/);
});
