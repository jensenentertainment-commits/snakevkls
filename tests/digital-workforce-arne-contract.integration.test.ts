import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getArneDevelopmentContext } from "../lib/intelligence/arne/development-context.ts";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Arne keeps the active admin-only HTTP and model contract", async () => {
  const [route, runtime, employee, chatServer, ui, page] = await Promise.all([
    source("app/api/arne/ask/route.ts"),
    source("lib/intelligence/workforce/runtime.ts"),
    source("lib/intelligence/workforce/employees/arne.ts"),
    source("lib/intelligence/shared/chat-server.ts"),
    source("app/components/AskBorre.tsx"),
    source("app/arne/page.tsx"),
  ]);

  assert.match(route, /export async function POST\(req: Request\)/);
  assert.match(route, /requireRole\(\["admin"\]\)/);
  assert.match(route, /validateChatInput\(body\)/);
  assert.match(route, /runReadOnlyEmployeeRequest\(\{/);
  assert.match(route, /employeeId: "arne"/);
  assert.match(route, /capabilityId: "snake\.assess_development"/);
  assert.match(route, /return NextResponse\.json\([\s\S]*\{ answer: result\.answer \}/);
  assert.match(chatServer, /CHAT_MODEL = "gpt-5-mini"/);
  assert.match(employee, /id:\s*CHAT_MODEL/);
  assert.match(employee, /getSystemPrompt:\s*getArneSystemPrompt/);
  assert.match(runtime, /Arne fikk ikke svart\. Det er irriterende, men teknisk mulig\./);
  assert.match(ui, /const endpoint = isArne \? "\/api\/arne\/ask"/);
  assert.match(page, /profile\.role !== "admin"/);
  assert.doesNotMatch(route, /\btools\s*:|\btool_choice\s*:|\bfunction_call\s*:/);
});

test("Arne keeps the exact context blocks and model message order", async () => {
  const builder = await source("lib/intelligence/arne/chat-input-builder.ts");
  const knowledgeIndex = builder.indexOf("=== Snake Knowledge ===");
  const developmentIndex = builder.indexOf("=== Development Context ===");
  const operationalIndex = builder.indexOf("=== Operational Context ===");
  const pageIndex = builder.indexOf("=== Current Page ===");

  assert.ok(knowledgeIndex >= 0);
  assert.ok(developmentIndex > knowledgeIndex);
  assert.ok(operationalIndex > developmentIndex);
  assert.ok(pageIndex > operationalIndex);
  assert.match(
    builder,
    /role: "system"[\s\S]*formatArneBackgroundContext\(input\.context\)[\s\S]*\.\.\.input\.history\.map[\s\S]*content: input\.question/
  );
  assert.equal((builder.match(/JSON\.stringify\([^)]*, null, 2\)/g) ?? []).length, 2);
  assert.match(builder, /context\.page \?\? "ukjent"/);
});

test("Arne keeps stable development context without roadmap claims", () => {
  assert.deepEqual(getArneDevelopmentContext(), {
    project: "Snake OS",
    purpose:
      "Outlet Service AS sin interne arbeidsplattform, med Varekompaniet som dagens operative brand og nettbutikk.",
    currentModules: [
      "Dashboard", "Lager", "Produkter", "Lokasjoner", "Issues",
      "Activities", "Børre", "Viper", "Snake Labs", "Innstillinger",
    ],
    principles: [
      "Bygg små, ferdige steg.",
      "Ikke bygg funksjoner før behovet er tydelig.",
      "Snake skal føles rolig, praktisk og ryddig.",
      "Børre skal føles som en lagerassistent, ikke som en AI-chat.",
      "Regular Børre hjelper med drift. Arne hjelper med utvikling.",
      "Unngå store omskrivinger uten god grunn.",
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
