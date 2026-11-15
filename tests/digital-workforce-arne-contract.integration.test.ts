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

test("Arne uses reviewed knowledge without operational claims or personal data", async () => {
  const builder = await source("lib/intelligence/arne/chat-input-builder.ts");
  const provider = await source("lib/intelligence/workforce/contexts/arne-advisory-context-provider.ts");
  assert.doesNotMatch(builder, /context\.operationalContext|context\.snakeKnowledge/);
  assert.doesNotMatch(provider, /getSnakeOperationalContext|buildSnakeKnowledgePrompt|supabase|dashboard/);
  const context = getArneDevelopmentContext();
  assert.ok(context.currentModules.includes("Shopify / Roy"));
  assert.ok(context.currentModules.includes("Lokasjonstelling"));
  assert.ok(!context.currentModules.includes("Dashboard"));
  const rules = context.warehouseRules.join(" ");
  for (const phrase of ["SKU er valgfri", "Flere lagerposter", "Nullbeholdning", "ikke bekreftede feil", "skriver ikke beholdningsantallet", "Én aktiv", "Serveren validerer", "justerer ikke beholdningen automatisk"]) assert.ok(rules.includes(phrase), phrase);
  assert.match(context.knowledge.limitations, /Ingen aktuelle lagertall/);
  assert.match(rules, /skriver ikke antall eller plasseringer/);
  assert.match(rules, /lagret observasjon, ikke registrert Snake-beholdning/);
  assert.match(context.responsibilities.join(" "), /Roy tilbyr ikke en Shopify–Snake-differanserapport/);
  assert.match(context.responsibilities.join(" "), /Fysisk telling gjøres av ansatte i Lokasjonstelling/);
  const prompt = await source("lib/intelligence/arne/system.ts");
  assert.match(prompt, /Ikke anbefal full synkronisering eller lagerendringer uten konkret/);
  assert.match(prompt, /tidligere modellpåstander/);
  assert.match(prompt, /Børre; katalogfakta hører til Roy/);
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
