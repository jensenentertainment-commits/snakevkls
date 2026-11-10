import { describePlacement, locationStock, productStock, resolveProduct, type StockData } from "./stock-contract.ts";
import type { BorreRoute } from "./conversation-route.ts";
import { displayProductName } from "../roy/display-text.ts";
import { formatRoyTime } from "../roy/format-time.ts";

export type BorreConversationContext = { route: BorreRoute; answer: string | null; readAt: string | null };
const text = (value: string) => displayProductName(value).replace(/[\r\n\u2028\u2029]/gu, " ").slice(0, 120);
const incomplete = "Fysisk lagerregistrering er ufullstendig eller ukjent; dette er registrerte tall, ikke en fysisk telling.";
const countLimit = "Jeg har ikke hentet fysiske tellinger eller status for telleavvik. En forskjell mot Shopify bekrefter ikke en lagerfeil.";
const evidence = (at: string) => `Kilden er lagrede Snake-data, lest ${formatRoyTime(at)}. Lesingen er ikke ett atomisk øyeblikksbilde. Ingen ny Shopify-kontroll er utført.`;
const placementReason: Record<string, string> = { unplaced: "uten lokasjon", location_unknown: "ukjent lokasjon", location_inactive: "inaktiv lokasjon",
  zone_unknown: "ukjent sone", zone_inactive: "inaktiv sone", zone_mismatch: "ulik sonekobling" };

export function buildBorreAnswer(route: BorreRoute, data: StockData | null, readAt: string): string | null {
  if (route.clarification) return route.clarification;
  if (!route.target || !data) return null;
  const limit = route.detail ? 8 : 3;
  const finish = (lines: string[]) => {
    const all = lines.filter(Boolean);
    if (all.join("\n").length <= 1900) return all.join("\n");
    const shown: string[] = [];
    for (const line of all) {
      if ([...shown, line].join("\n").length > 1250) break;
      shown.push(line);
    }
    return [...shown, "Visningen er avgrenset. Oppgi en konkret lokasjon eller variant for resten av detaljene.",
      incomplete, "Sammenligningsomfang og ordrebehandling er ikke bekreftet. Tallene dokumenterer ikke en lagerfeil.", evidence(readAt)].join("\n");
  };
  if (route.target.kind === "product") {
    const match = resolveProduct(data, route.target.key);
    if (match.status === "not_found") return "Jeg fant ikke et produkt som samsvarer med oppslaget. Kontroller navnet eller oppgi eksakt produkt-UUID eller Shopify Variant-ID.";
    if (match.status === "ambiguous") return finish([
      `Jeg fant ${match.candidates.length} kandidater og har ikke valgt et produkt. Hvilken variant mener du?`,
      ...match.candidates.slice(0, 3).map(p => `${text(p.name)}${p.variantName ? ` – ${text(p.variantName)}` : ""}: ${p.variantId ?? p.productUuid}`),
      match.candidates.length > 3 ? "Viser tre kandidater. Avgrens produktnavnet eller oppgi eksakt ID." : "",
    ]);
    const stock = productStock(data, match.candidates[0].productUuid);
    if (stock.registeredQuantity === null) return "Lagerpostene inneholder ugyldige antall. Jeg kan ikke gi en pålitelig sum fra dette datagrunnlaget.";
    const placements = stock.placements.filter(p => p.quantity > 0 && (!route.purpose || p.purpose === route.purpose));
    const lead = `${text(stock.name)}${stock.variantName ? ` – ${text(stock.variantName)}` : ""}: ${stock.registeredQuantity} enheter registrert i Snake totalt.`;
    const lines = [lead];
    if (!stock.active) lines.push("Produktet er inaktivt i katalogen.");
    if (route.purpose) lines.push(`${placements.reduce((sum, p) => sum + p.quantity, 0)} enheter er registrert på ${route.purpose}-lokasjoner. Dette er ikke en garanti for plukkbar beholdning.`);
    if (route.topic === "count") lines.push(countLimit);
    else if (route.topic === "difference" || route.topic === "evidence") {
      if (stock.shopify.state === "observed") {
        lines.push(`Shopify: sist lagret tilgjengelig beholdning er ${stock.shopify.quantity}, observert ${formatRoyTime(stock.shopify.observedAt)} på ${stock.shopify.locationId}.`);
        lines.push(`Regneforskjellen Snake minus Shopify er ${stock.difference.snakeMinusShopify}. Lageromfanget er ikke bekreftet likt, og ordrebehandling er ikke vurdert. Dette er ikke et bekreftet telleavvik.`);
      } else lines.push("Shopify-beholdningen er ukjent i det tilgjengelige datagrunnlaget. Jeg beregner derfor ingen differanse.");
    } else {
      lines.push(...placements.slice(0, limit).map(p => `${p.locationCode ?? "Uten kjent lokasjon"} · ${p.zoneCode ?? "ukjent sone"} · ${p.purpose === "unknown" ? "ukjent formål" : p.purpose}: ${p.quantity}${p.placementIssue ? ` (${placementReason[p.placementIssue]})` : ""}.`));
      if (placements.length > limit) lines.push(`Viser ${limit} av ${placements.length} plasseringer. Be om detaljer eller en konkret lokasjon.`);
      if (!placements.length) lines.push(route.purpose ? `Ingen positiv beholdning er registrert på ${route.purpose}-lokasjoner.` : "Ingen positiv beholdning er registrert på lagerpostene.");
    }
    if (stock.sku === null && (route.detail || /name/.test(route.target.key.kind))) lines.push("SKU mangler, men produktidentiteten er entydig. Det er ikke et lageravvik.");
    lines.push(incomplete);
    if (route.detail || route.topic === "evidence") lines.push(evidence(readAt));
    return finish(lines);
  }
  if (route.target.kind === "location") {
    if (data.locations.length !== 1) return "Jeg fant ikke én entydig lokasjon med denne koden. Kontroller lokasjonskoden.";
    const result = locationStock(data, data.locations[0].id);
    if (result.status !== "found") return "Lokasjonen er ukjent.";
    if (result.entries.some(r => !Number.isSafeInteger(r.quantity) || r.quantity < 0)) return "Lokasjonen har ugyldige beholdningstall. Jeg kan ikke gi en sikker lageroversikt.";
    const rows = result.entries.filter(r => r.quantity > 0);
    return finish([`${result.location.code} · ${result.zone?.code ?? "ukjent sone"} · ${result.location.location_purpose ?? "ukjent formål"}${result.location.active ? "" : " · inaktiv"}.`,
      rows.length ? `${rows.length} lagerposter har positiv registrert beholdning:` : "Ingen positiv beholdning er registrert her. Det er ikke i seg selv et avvik eller en bekreftelse på at plassen er fysisk tom.",
      ...rows.slice(0, limit).map(r => `${text(r.product?.product_name ?? "Ukjent produkt")} (${r.product?.shopify_variant_id ?? r.productUuid}): ${r.quantity}.`),
      rows.length > limit ? `Viser ${limit} av ${rows.length} poster.` : "", incomplete,
      route.topic === "count" ? countLimit : "",
      route.detail || route.topic === "evidence" ? evidence(readAt) : ""]);
  }
  const rows = data.inventory.map(r => describePlacement(data, r));
  const sum = rows.reduce((n, r) => n + r.quantity, 0);
  if (!Number.isSafeInteger(sum) || rows.some(r => !Number.isSafeInteger(r.quantity) || r.quantity < 0)) return "Beholdningstallene er ufullstendige eller ugyldige. Jeg kan ikke gi en sikker totalsum.";
  const findings = rows.filter(r => r.placementIssue);
  const products = new Set(findings.map(r => r.productUuid)).size;
  return finish([
    route.target.kind === "summary" ? `${sum} enheter er registrert i Snake, fordelt på ${rows.filter(r => r.quantity > 0).length} lagerposter med positiv beholdning.` : "",
    `${products} produkter har positiv beholdning uten gyldig plassering (${findings.length} lagerposter). Nullposter er ikke regnet som plasseringsproblemer.`,
    ...findings.slice(0, limit).map(r => `${text(data.products.find(p => p.id === r.productUuid)?.product_name ?? "Ukjent produkt")}: ${r.quantity}, ${placementReason[r.placementIssue!]}.`),
    findings.length > limit ? `Viser ${limit} av ${findings.length} lagerposter. Avgrens med produktnavn eller ID for detaljer.` : "",
    incomplete, route.topic === "count" ? countLimit : "",
    route.topic === "difference" ? "Jeg har ikke sammenlignet hele lageret med Shopify. Oppgi en konkret variant for å se den lagrede observasjonen og forbeholdene." : "",
    route.detail || route.topic === "evidence" ? evidence(readAt) : "",
  ]);
}
