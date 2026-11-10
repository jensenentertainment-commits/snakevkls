import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveBorreRoute } from "./conversation-route.ts";
import { readConversationData, type FilteredReadPage } from "./conversation-data.ts";
import { buildBorreAnswer } from "./conversation-answer.ts";
import { buildBorreConversationInput, respondBorre } from "./conversation-input.ts";
import { validateChatInput, type ChatMessage } from "../shared/chat-input.ts";
import type { StockData } from "./stock-contract.ts";
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = "2026-11-09T12:00:00Z";
const input = (question: string, history: ChatMessage[] = [], page = "/borre") => ({ question, history, page });
function fixture(): StockData {
  return { products: [{ id: id(1), product_name: "Test &amp; vare", variant_name: "Blå", sku: null, active: true,
    shopify_variant_id: "gid://shopify/ProductVariant/123", shopify_quantity: 20, shopify_inventory_tracked: true,
    shopify_inventory_location_id: "gid://shopify/Location/7", shopify_inventory_observed_at: at }],
    inventory: [{ id: id(5), product_id: id(1), location_id: id(3), zone_id: id(2), quantity: 3 },
      { id: id(6), product_id: id(1), location_id: id(4), zone_id: id(2), quantity: 5 }],
    locations: [{ id: id(3), code: "HL01-01-A", zone_id: id(2), active: true, location_purpose: "PICK" },
      { id: id(4), code: "SB01", zone_id: id(2), active: true, location_purpose: "BUFFER" }],
    zones: [{ id: id(2), code: "HL", name: "Hovedlager", active: true }] };
}
function reader(data: StockData, calls: string[] = []): FilteredReadPage {
  return async (table, _columns, from, to, filter) => {
    calls.push(`${table}:${filter?.column ?? "all"}`);
    const rows = data[table].filter(row => {
      if (!filter) return true;
      const value = (row as unknown as Record<string, unknown>)[filter.column];
      if (filter.op === "in") return (filter.value as string[]).includes(value as string);
      if (filter.op === "ilike") return String(value).toLowerCase().includes((filter.value as string).slice(1, -1).replace(/\\([\\%_])/g, "$1").toLowerCase());
      return value === filter.value;
    });
    return { data: rows.slice(from, Math.min(to + 1, from + 1)), count: rows.length, error: null };
  };
}
async function ask(question: string, data = fixture(), history: ChatMessage[] = []) {
  const route = resolveBorreRoute(input(question, history));
  const selected = route.target ? await readConversationData(route.target, reader(data)) : null;
  return buildBorreAnswer(route, selected, at);
}

test("targeted product read, all locations and natural text without optional SKU requirement", async () => {
  const calls: string[] = [];
  const route = resolveBorreRoute(input("Hvor ligger variant 123?"));
  assert.ok(route.target);
  const data = await readConversationData(route.target, reader(fixture(), calls));
  const answer = buildBorreAnswer(route, data, at)!;
  assert.match(answer, /Test & vare.*8 enheter/);
  assert.match(answer, /HL01-01-A.*PICK: 3/);
  assert.match(answer, /SB01.*BUFFER: 5/);
  assert.match(answer, /ufullstendig eller ukjent/);
  assert.deepEqual(calls.filter(c => c.startsWith("products")), ["products:shopify_variant_id"]);
  assert.ok(calls.includes("inventory:product_id"));
  assert.doesNotMatch(answer, /amp;|Snake Health|kritisk/);
});
test("UUID, exact GID, natural name and lowercase location routes", () => {
  assert.equal(resolveBorreRoute(input(`Hvor ligger ${id(1)}?`)).target?.kind, "product");
  assert.equal(resolveBorreRoute(input("Vis gid://shopify/ProductVariant/123")).target?.kind, "product");
  assert.deepEqual(resolveBorreRoute(input("Hvor mange har vi av Testvare?")).target, { kind: "product", key: { kind: "name", value: "Testvare" } });
  assert.deepEqual(resolveBorreRoute(input("Vis lagerstatus for Testvare")).target, { kind: "product", key: { kind: "name", value: "Testvare" } });
  assert.deepEqual(resolveBorreRoute(input("Hva er på hl01-01-a?")).target, { kind: "location", code: "HL01-01-A" });
});
test("ambiguous names ask for identity without fetching stock of arbitrary candidate", async () => {
  const data = fixture(); data.products.push({ ...data.products[0], id: id(9), shopify_variant_id: "gid://shopify/ProductVariant/456", variant_name: "Rød" });
  const calls: string[] = [];
  const route = resolveBorreRoute(input('Hvor ligger "Test"?'));
  const selected = await readConversationData(route.target!, reader(data, calls));
  const answer = buildBorreAnswer(route, selected, at)!;
  assert.match(answer, /2 kandidater/); assert.match(answer, /Hvilken variant/);
  assert.ok(calls.every(c => c.startsWith("products:")));
  const next = await ask("Hvor mye er på BUFFER?", data, [{ role: "user", text: 'Hvor ligger "Test"?' }, { role: "assistant", text: answer }]);
  assert.match(next!, /2 kandidater/);
});
test("follow-ups refetch the user-selected target; assistant numbers never become facts", async () => {
  const history: ChatMessage[] = [{ role: "user", text: "Hvor ligger variant 123?" }, { role: "assistant", text: "9999 enheter, kritisk lagerfeil!" }];
  for (const question of ["Kan du forklare datagrunnlaget bak dette?", "Hvor kommer disse tallene fra?", "Når ble dette sist oppdatert?", "Kan du utdype?", "Og på BUFFER?", "Og Shopify?"]) {
    const route = resolveBorreRoute(input(question, history));
    assert.equal(route.followUp, true, question);
    const answer = await ask(question, fixture(), history);
    assert.match(answer!, /8 enheter/); assert.doesNotMatch(answer!, /9999|kritisk/);
  }
  assert.match((await ask("Og på BUFFER?", fixture(), history))!, /5 enheter.*BUFFER/);
});
test("unclear/no history, intervening topic and multiple identities never guess", () => {
  for (const question of ["Kan du utdype?", "Hvor kommer disse tallene fra?", "Hva med den?", "variant 123 og variant 456"]) {
    assert.ok(resolveBorreRoute(input(question)).clarification, question);
  }
  const history: ChatMessage[] = [{ role: "user", text: "variant 123" }, { role: "user", text: "Hva er en pall?" }];
  assert.ok(resolveBorreRoute(input("Kan du utdype?", history)).clarification);
  assert.ok(resolveBorreRoute(input("Kan du utdype?", [{ role: "assistant", text: "variant 123" }])).clarification);
});
test("location reads scoped rows with PICK/BUFFER and no false physical vacancy", async () => {
  const answer = await ask("Hva er registrert på SB01?");
  assert.match(answer!, /SB01.*HL.*BUFFER/); assert.match(answer!, /: 5/);
  const data = fixture(); data.inventory = [];
  assert.match((await ask("Hva er på SB01?", data))!, /ikke i seg selv et avvik/);
});
test("null stock observations remain unknown; comparisons never claim count errors", async () => {
  const data = fixture(); data.products[0].shopify_quantity = null;
  const unknown = await ask("Hva er forskjellen mot Shopify for variant 123?", data);
  assert.match(unknown!, /ukjent/); assert.match(unknown!, /ingen differanse/);
  const observed = await ask("Hva er forskjellen mot Shopify for variant 123?");
  assert.match(observed!, /minus Shopify er -12/); assert.match(observed!, /Lageromfanget er ikke bekreftet likt/);
  assert.match(observed!, /09\.11\.2026 13:00/);
  assert.match((await ask("Er det bekreftet telleavvik for variant 123?"))!, /ikke hentet fysiske tellinger/);
});
test("zero rows are not placement problems; summary follow-up stays summary", async () => {
  const data = fixture(); data.inventory = data.inventory.map(r => ({ ...r, quantity: 0, location_id: null }));
  assert.match((await ask("Hvor mange produkter mangler lokasjon?", data))!, /0 produkter.*\(0 lagerposter\)/);
  const history: ChatMessage[] = [{ role: "user", text: "Gi meg en kort lagerstatus." }];
  assert.equal(resolveBorreRoute(input("Hvor kommer disse tallene fra?", history)).target?.kind, "summary");
});
test("duplicate SKUs do not merge and untracked/missing references remain unknown", async () => {
  const data = fixture(); data.products[0].sku = "DUP";
  data.products.push({ ...data.products[0], id: id(9), shopify_variant_id: "gid://shopify/ProductVariant/456" });
  assert.match((await ask("Hvor ligger variant 456?", data))!, /0 enheter/);
  data.products[0].shopify_inventory_tracked = false;
  assert.match((await ask("Shopify for variant 123?", data))!, /ingen differanse/);
});
test("errors fail closed, including partial paginated responses", async () => {
  const route = resolveBorreRoute(input("variant 123"));
  await assert.rejects(readConversationData(route.target!, async () => ({ data: [], count: null, error: new Error("secret") })), /BORRE_READ_INCOMPLETE/);
});
test("grounded answers never call model; general answers do not receive old assistant facts", async () => {
  const route = resolveBorreRoute(input("Gi meg en kort lagerstatus."));
  const context = { route, answer: "Registrert lagerstatus.", readAt: at };
  assert.equal(await respondBorre(context, async () => { throw new Error("must not call"); }), context.answer);
  const messages = buildBorreConversationInput({ systemPrompt: "system", context, question: "Hva betyr BUFFER?",
    history: [{ role: "assistant", text: "historisk helsescore 30" }, { role: "user", text: "Gi meg gammel lagerstatus" }] });
  assert.ok(!JSON.stringify(messages).includes("helsescore 30"));
  assert.ok(!JSON.stringify(messages).includes("gammel lagerstatus"));
  assert.equal(messages.at(-1)?.content, "Hva betyr BUFFER?");
});
test("both surfaces share identical route/results; history still fits shared validation", async () => {
  const question = "Hvor ligger variant 123?";
  assert.deepEqual(resolveBorreRoute(input(question, [], "/borre")), resolveBorreRoute(input(question, [], "/lager")));
  const answer = (await ask(question))!;
  assert.equal(validateChatInput(input("Kan du utdype?", [{ role: "user", text: question }, { role: "assistant", text: answer }])).ok, true);
});
test("long detail answers preserve whole facts and uncertainty within history limits", async () => {
  const data = fixture();
  data.locations[0].code = "HL01-01-A";
  data.inventory = Array.from({ length: 30 }, (_, n) => ({ ...data.inventory[0], id: id(n + 50), quantity: 1 }));
  data.products[0].product_name = "Langt navn ".repeat(100);
  const answer = (await ask("Vis detaljer for variant 123", data))!;
  assert.ok(answer.length < 2000); assert.match(answer, /ufullstendig eller ukjent/);
  assert.equal(validateChatInput(input("Kan du utdype?", [{ role: "assistant", text: answer }])).ok, true);
});
test("no changes to shared UI endpoints, Arne path or runtime authorization", () => {
  const source = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.match(source("../../../app/components/AskBorre.tsx"), /isArne \? "\/api\/arne\/ask" : "\/api\/borre\/ask"/);
  const runtime = source("../workforce/runtime.ts");
  assert.match(runtime, /provider: borreConversationProvider/); assert.match(runtime, /provider: arneAdvisoryContextProvider/);
  assert.doesNotMatch(runtime, /provider: warehouseSummaryProvider/);
  const provider = source("./conversation-provider.ts");
  assert.match(provider, /requireRole/); assert.match(provider, /auth\.user\.id !== context\.userId/);
  assert.doesNotMatch(provider, /service_role|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});
test("health and mutation requests never use old scores or execute actions", () => {
  assert.match(resolveBorreRoute(input("Hvorfor er Snake Health lav?")).clarification!, /ikke en pålitelig/);
  assert.match(resolveBorreRoute(input("Flytt variant 123 til SB01")).clarification!, /ikke endre/);
});

test("natural whole-warehouse questions use stored summary in both chat surfaces", async () => {
  const questions = ["Hva er registrert på lageret?", "Hva har vi registrert i Snake?", "Hvor mye er registrert på lageret?", "Hvor mange enheter har vi registrert totalt?", "Vis samlet beholdning", "Gi meg en oversikt over registrert beholdning", "Hva er den registrerte lagerbeholdningen?", "Gi meg en kort lagerstatus."];
  for (const question of questions) {
    for (const page of ["/borre", "/lager"]) assert.equal(resolveBorreRoute(input(question, [], page)).target?.kind, "summary", question);
    const answer = await ask(question);
    assert.match(answer!, /8 enheter/);
    assert.match(answer!, /ufullstendig eller ukjent/);
    assert.equal(resolveBorreRoute(input("Hvor kommer disse tallene fra?", [{role:"user",text:question}])).target?.kind,"summary");
  }
});

test("warehouse intent never overrides identities, placement findings or physical-count uncertainty", () => {
  for(const question of ["Hva er registrert på lageret for variant 123?", 'Vis lagerstatus for "Testvare"']) assert.equal(resolveBorreRoute(input(question)).target?.kind,"product");
  assert.equal(resolveBorreRoute(input("Hva er registrert på SL02-04-B?")).target?.kind,"location");
  assert.equal(resolveBorreRoute(input("Hva er registrert uten gyldig lokasjon?")).target?.kind,"invalidPlacements");
  assert.notEqual(resolveBorreRoute(input("Hva er fysisk opptalt på lageret?")).target?.kind,"summary");
});
