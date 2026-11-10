import type { ValidChatInput } from "../shared/chat-input.ts";
import type { ProductKey } from "./stock-contract.ts";

export type StockTarget = { kind: "product"; key: ProductKey } | { kind: "location"; code: string }
  | { kind: "summary" } | { kind: "invalidPlacements" };
export type BorreRoute = { target: StockTarget | null; clarification: string | null;
  followUp: boolean; detail: boolean; topic: "stock" | "difference" | "evidence" | "count" | "purpose" | "general";
  purpose: "PICK" | "BUFFER" | null };

const followUp = /^(?:(?:og|men)\s+)?(?:hvor kommer .*tall|kan du (?:utdype|forklare)|utdyp|hvorfor|når ble|hva betyr (?:det|dette)|hva med (?:den|det|disse)|hvor (?:ligger|er) (?:den|det|de)|vis (?:de|dem|detalj)|(?:hvor mye|hva) (?:er|har|ligger).*(?:der|buffer|pick)|(?:på|i) (?:pick|buffer)|hvilke lokasjoner|(?:shopify|snake)[?.!\s]*$)/iu;
function topic(question: string): BorreRoute["topic"] {
  if (/telleavvik|opptalt|telling|bekreftet.*avvik/iu.test(question)) return "count";
  if (/datagrunnlag|tallene fra|sist oppdatert|sist observert|når ble/iu.test(question)) return "evidence";
  if (/forskjell|differanse|shopify|stemmer ikke/iu.test(question)) return "difference";
  if (/pick|buffer/iu.test(question)) return "purpose";
  return "stock";
}
function explicitTarget(question: string): StockTarget | "ambiguous" | null {
  const variants = [...question.matchAll(/gid:\/\/shopify\/ProductVariant\/[1-9]\d*|(?:variant(?:-?id)?\s*[:#]?\s*)([1-9]\d*)/giu)]
    .map(m => m[1] ? `gid://shopify/ProductVariant/${m[1]}` : m[0]);
  const uuids = question.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu) ?? [];
  const codes = variants.length || uuids.length ? [] : question.match(/\b[A-ZÆØÅ]{2}\d{2}(?:-\d{2}-[A-D])?\b/giu) ?? [];
  if (variants.length + uuids.length + codes.length > 1) return "ambiguous";
  if (variants.length) return { kind: "product", key: { kind: "variantId", value: variants[0] } };
  if (uuids[0]) return { kind: "product", key: { kind: "productUuid", value: uuids[0].toLowerCase() } };
  if (codes[0]) return { kind: "location", code: codes[0].toUpperCase() };
  if (/uplassert|uten (?:gyldig )?lokasjon|mangler (?:en )?lokasjon/iu.test(question)) return { kind: "invalidPlacements" };
  // Whole-warehouse intent, before name extraction. Explicit identities above still win.
  const overviewQuestion = question.trim().replace(/[?.!]+$/u, "");
  if (/^(?:hva (?:er|har vi) registrert (?:på lager(?:et)?|i snake)|(?:hvor mye|hvor mange (?:varer|enheter)) (?:er registrert|har vi registrert)(?: (?:totalt|til sammen))?(?: (?:på lager(?:et)?|i snake))?|(?:vis|gi meg)(?: en)?(?: oversikt over)? (?:den )?(?:registrert(?:e)?|samlet|total) (?:lagerbeholdning|beholdning)(?: i snake)?|hva er (?:den )?(?:registrerte|samlede|totale) (?:lagerbeholdningen|beholdningen)(?: i snake)?)$/iu.test(overviewQuestion)) return { kind: "summary" };
  const quoted = [...question.matchAll(/[«"]([^»"]{2,200})[»"]/gu)];
  if (quoted.length > 1) return "ambiguous";
  let name = quoted[0]?.[1] ?? question.match(/^(?:hvor (?:ligger|finner jeg)\s+|hvor (?:mye|mange) har vi (?:av\s+)?|(?:vis|hva er) (?:lagerstatus|beholdningen|beholdning) (?:for|på|av)\s+|hva med\s+)(.+?)[?.!]*$/iu)?.[1];
  name = name?.trim().replace(/\s+(?:på lager|i snake)[?.!]*$/iu, "").trim();
  if (name && name.length >= 2 && name.length <= 200 && !/^(?:den|det|de|dem|denne|dette|disse|varen|produktet|der|pick|buffer|lageret)(?:\s|$)/iu.test(name)) {
    return { kind: "product", key: { kind: "name", value: name } };
  }
  if (/lagerstatus|lageroversikt|hva bør jeg gjøre først|kort status|total.*beholdning|samlet.*beholdning/iu.test(question)) return { kind: "summary" };
  return null;
}

export function resolveBorreRoute(input: ValidChatInput): BorreRoute {
  const question = input.question.trim();
  const base: BorreRoute = { target: null, clarification: null, followUp: false,
    detail: /detalj|utdyp|utdype|forklar|datagrunnlag|tallene fra/iu.test(question), topic: topic(question),
    purpose: /\bbuffer\b/iu.test(question) && !/\bpick\b/iu.test(question) ? "BUFFER"
      : /\bpick\b/iu.test(question) && !/\bbuffer\b/iu.test(question) ? "PICK" : null };
  if (/^(?:kan du\s+)?(?:flytt|slett|endre|registrer|juster|reserver|start synk|oppdater beholdning)/iu.test(question)) return { ...base, clarification: "Jeg kan lese lagerdata, men ikke endre beholdning, flytte varer eller starte synkronisering." };
  if (/snake health/iu.test(question)) return { ...base, clarification: "Snake Health er ikke en pålitelig vurdering av lageret. Jeg kan heller vise registrert beholdning eller positive lagerposter uten gyldig lokasjon." };
  if (/\bsku\s*[:#]?\s*[\w-]+/iu.test(question) && !/uten sku|mangler sku/iu.test(question)) {
    return { ...base, clarification: "SKU er ikke en entydig produktidentitet. Oppgi produktnavn, produkt-UUID eller Shopify Variant-ID." };
  }
  const target = explicitTarget(question);
  if (target === "ambiguous") return { ...base, clarification: "Hvilket produkt eller hvilken lokasjon mener du? Oppgi én identitet om gangen." };
  if (target) return { ...base, target };
  if (followUp.test(question) || /\b(?:dette|disse|den|der)\b/iu.test(question)) {
    // Only user-supplied selectors, never assistant prose/numbers, establish identity.
    for (const message of [...input.history].reverse()) {
      if (message.role !== "user") continue;
      const prior = explicitTarget(message.text);
      if (prior && prior !== "ambiguous") return { ...base, target: prior, followUp: true };
      if (prior === "ambiguous" || !followUp.test(message.text.trim())) break;
    }
    return { ...base, clarification: "Hva viser du til? Oppgi produktnavn, Variant-ID eller lokasjonskode, så kan jeg forklare grunnlaget." };
  }
  if (base.topic === "count") return { ...base, clarification: "En beholdningsforskjell er ikke et bekreftet telleavvik. Jeg har ikke hentet fysiske tellinger eller avvikenes oppfølgingsstatus i dette leselaget." };
  if (/shopify|beholdning|produkt|lokasjon|vare|lagerforskjell/iu.test(question) && base.topic !== "purpose") {
    return { ...base, clarification: "Hvilket produkt eller hvilken lokasjon vil du se på? Du kan bruke produktnavn, produkt-UUID, Shopify Variant-ID eller lokasjonskode." };
  }
  return { ...base, topic: "general" };
}
