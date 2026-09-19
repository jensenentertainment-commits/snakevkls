import { phase2aModelContext, requestedContentField, type Phase2aContext } from "./phase2a-context.ts";
import { TARGET_FIELDS, type TargetField, type ObservedPreview } from "./targeted-content-contract.ts";

const labels: Record<TargetField, string> = {
  productName: "Produktnavn", description: "Produktbeskrivelse", seoTitleOverride: "Eksplisitt Shopify SEO-titteloverstyring",
  seoDescriptionOverride: "Eksplisitt Shopify SEO-beskrivelsesoverstyring", productHandle: "Shopify-handle",
  productType: "Merchant-definert produkttype", shopifyCategory: "Shopify Product Category", imageReference: "Featured-image-referanse",
};
// Source values are quoted data. Never parse their contents as instructions or
// promote them to findings. Escape Markdown/HTML and keep one physical line.
function quote(value: string): string {
  return `«${value.replace(/[\r\n\u2028\u2029]/gu, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\\`*_{}\[\]()#!|]/g, "\\$&")}»`;
}
function fieldSentence(field: TargetField, f: ObservedPreview) {
  if (f.state === "unknown") return `${labels[field]}: ukjent – Snake har ingen vellykket kanonisk observasjon.`;
  if (f.state === "missing") return `${labels[field]}: observert, men eksplisitt tom/null.`;
  return `${labels[field]}: observert verdi${f.withheld ? "; verdien er holdt tilbake fra visningen" : ` ${quote(f.value!)}${f.truncated ? " (avkortet forhåndsvisning)" : ""}`}.`;
}
const SOURCE_SCOPE = "Dette er Snakes lagrede aktive Shopify-tilknyttede katalog, ikke en uavhengig verifisert live Shopify-katalog.";
const SEO_NOTE = "Tom eksplisitt SEO-overstyring beviser ikke at den gjengitte søkemotortittelen/metabeskrivelsen mangler; Shopify kan bruke standardverdier.";
const QUALITY_NOTE = "Jeg kan beskrive observasjon og tilstedeværelse, men ikke vurdere kvalitet, rangering, korrekt kategorisering eller collection-relevans.";

export function presentPhase2a(raw: Phase2aContext, question: string): string {
  const c = phase2aModelContext(raw);
  if (c.source === "roy_phase2a_guidance_v1") {
    if (c.reason === "clarify") return "Jeg kan ikke avgjøre hvilket produkt du mener. Oppgi én entydig SKU, så undersøker jeg det uten å gjette.";
    if (c.reason === "unsupported") return QUALITY_NOTE;
    return "Jeg kan lese variantfakta og kanoniske observasjoner av produktbeskrivelse, eksplisitte SEO-overstyringer, handle, produkttype, Shopify Product Category og collections, samt avgrensede katalogaggregater. Ukjent er ikke manglende. " + QUALITY_NOTE;
  }
  if (c.source === "roy_catalog_foundation_v1") {
    const d = c.data;
    const lines = [`Kataloggrunnlaget omfatter ${d.totals.productCount} produkter og ${d.totals.variantCount} varianter.`, SOURCE_SCOPE,
      `${d.contentCoverage.observedProductCount} produkter har observert kanonisk innhold; ${d.contentCoverage.unknownProductCount} har ukjent innhold.`];
    const fields = c.field === "collections" ? [] : c.field ? [c.field] : TARGET_FIELDS;
    for (const field of fields) {
      const key = field === "seoTitleOverride" ? "seoTitle" : field === "seoDescriptionOverride" ? "seoDescription" : field;
      const counts = d.fields[key];
      lines.push(`${labels[field]}: ${counts.presentCount} til stede, ${counts.missingCount} observert tomme, ${counts.unknownCount} ukjente produkter.`);
    }
    if (!c.field || c.field === "collections") {
      const m = d.collections;
      lines.push(`Collections: ${m.unknownOrIncompleteProductCount} produkter har ukjent/ufullstendig observasjon. ${m.completeProductCount} har komplett observasjon: ${m.completeWithZeroCollectionsCount} uten collections og ${m.completeWithCollectionsCount} med medlemskap.`);
    }
    // Use only the RPC's globally allocated examples; never refill or infer counts.
    const fieldCode: Record<TargetField | "collections", string[]> = {
      productName: ["missing_product_name"], description: ["missing_description"], seoTitleOverride: ["missing_seo_title"],
      seoDescriptionOverride: ["missing_seo_description"], productHandle: ["missing_product_handle"], productType: ["missing_product_type"],
      shopifyCategory: ["missing_shopify_category"], imageReference: ["missing_image_reference"],
      collections: ["collections_unknown_or_incomplete", "collections_complete_zero"],
    };
    const findingLabel: Record<string, string> = {
      content_unknown: "ukjent kanonisk innhold", missing_product_name: "observert tomt produktnavn",
      missing_description: "observert tom produktbeskrivelse", missing_seo_title: "observert tom eksplisitt SEO-titteloverstyring",
      missing_seo_description: "observert tom eksplisitt SEO-beskrivelsesoverstyring", missing_product_handle: "observert tom handle",
      missing_product_type: "observert tom produkttype", missing_shopify_category: "observert tom Shopify Product Category",
      missing_image_reference: "observert tom featured-image-referanse", collections_unknown_or_incomplete: "ukjent/ufullstendig collection-observasjon",
      collections_complete_zero: "komplett observasjon uten collections",
    };
    for (const f of d.findings.filter(f => !c.field || fieldCode[c.field].includes(f.code))) {
      if (f.examples.length) lines.push(`Avgrensede eksempler fra det kanoniske kataloggrunnlaget – ${findingLabel[f.code]}: ${f.examples.map(e => `${quote(e.productLabel)}${e.representativeSku ? ` (representativ SKU ${quote(e.representativeSku)})` : ""}${e.labelTruncated || e.skuTruncated ? " [avkortet]" : ""}`).join(", ")}.`);
      if (f.examplesTruncated) lines.push(`Eksemplene for ${findingLabel[f.code]} er begrenset; antallet berørte produkter er ${f.affectedProductCount}.`);
    }
    const timeLabels = { variantSyncedAt: "Variantsynkronisering", contentObservedAt: "Snake-innholdsobservasjon", collectionsObservedAt: "Komplett collection-observasjon", shopifyUpdatedAt: "Shopify-kildeoppdatering", contentPersistedAt: "Innhold lagret i databasen" };
    for (const [key, label] of Object.entries(timeLabels)) {
      const r = d.freshness[key as keyof typeof d.freshness];
      lines.push(`${label}: ${r.timestampCount} av ${r.populationCount} ${r.populationUnit === "variant" ? "varianter" : "produkter"} med tidspunkt${r.oldest ? `, fra ${r.oldest} til ${r.newest}` : ""}.`);
    }
    if (!c.field || c.field.startsWith("seo")) lines.push(SEO_NOTE);
    lines.push(`Hentet ${d.generatedAt}. Tidspunktene beskriver siste lagrede observasjoner, kan variere mellom synksider og gir ingen klassifisering som foreldet.`);
    if (d.evidence.budgetLimited) lines.push("Eksempler er også begrenset av responsens bytebudsjett; aggregatene er uendret.");
    lines.push(QUALITY_NOTE);
    return lines.join("\n\n");
  }
  const d = c.data;
  if (d.status === "ambiguous") return "SKU-en gir flere mulige variant-/produktidentiteter. Jeg trenger en entydig SKU og velger ikke et produkt på dine vegne.";
  if (d.status === "not_found") return "Jeg fant ikke SKU-en i Snakes aktive Shopify-tilknyttede katalog. Det beviser ikke at produktet mangler i live Shopify.";
  const v = d.selectedVariant!;
  const content = d.productContent!;
  const field = requestedContentField(question);
  const general = !field;
  const lines = [`Jeg fant ${v.productName ? quote(v.productName) : "produktet"}${v.sku ? ` (SKU ${quote(v.sku)})` : ""}.`];
  if (v.textTruncated) lines.push("Variantens tekstfelt er avkortet eller holdt tilbake; ikke bruk forhåndsvisningen som en ny eksakt SKU.");
  if (general) {
    if (v.variantName) lines.push(`Valgt variant: ${quote(v.variantName)}.`);
    if (v.priceMinor !== null && v.currency) lines.push(`Variantpris: ${(v.priceMinor / 100).toLocaleString("nb-NO")} ${quote(v.currency)}.`);
    else lines.push("Variantpris/valuta er ikke tilgjengelig i det mottatte variantgrunnlaget.");
    lines.push(`Variantlager: ${v.quantity === null ? "ukjent" : v.quantity}. Sporing: ${v.inventoryTracked === null ? "ukjent" : v.inventoryTracked ? "aktiv" : "ikke aktiv"}. Lagerobservasjon: ${v.inventoryObservedAt ?? "ukjent"}.`);
    lines.push(`${d.variantCount} aktive varianter; ${d.siblingVariants.length} søskenvarianter vist${d.siblingsTruncated ? " (avgrenset utvalg)" : ""}.`);
    if (d.siblingVariants.length) lines.push(...d.siblingVariants.map(s => `- ${s.sku ? quote(s.sku) : "Uten vist SKU"}${s.variantName ? `: ${quote(s.variantName)}` : ""}${s.textTruncated ? " [avkortet/tilbakeholdt]" : ""}.`));
  }
  for (const f of general ? TARGET_FIELDS : field === "collections" ? [] : [field!]) lines.push(fieldSentence(f, content.fields[f]));
  if (general || field === "collections") {
    const m = d.canonicalCollections!;
    if (m.state === "unknown_or_incomplete") lines.push("Collection-medlemskap er ukjent/ufullstendig. Jeg kan ikke konkludere med at produktet har null collections.");
    else if (m.membershipCount === 0) lines.push(`Komplett observasjon ${m.observedAt}: produktet har ingen collections.`);
    else lines.push(`Komplett observasjon ${m.observedAt}: ${m.membershipCount} collection-medlemskap. Viste navn: ${m.names.map(quote).join(", ") || "ingen"}.${m.displayTruncated ? " Visningen er avkortet; kildeobservasjonen er fortsatt komplett." : ""}`);
  }
  if (general || field?.startsWith("seo")) lines.push(SEO_NOTE);
  if (general || field === "productHandle") lines.push("En observert handle beviser ikke at en offentlig URL fungerer.");
  if (general || field === "shopifyCategory" || field === "productType") lines.push("Shopify Product Category og merchant-definert produkttype er separate felt.");
  if (general || field === "imageReference") lines.push("En featured-image-referanse dokumenterer ikke bildekvalitet eller et komplett bildegalleri.");
  if (general || /oppdatert|synk|tidspunkt|fersk|foreldet/iu.test(question)) {
    lines.push(`Shopify-kildeoppdatering: ${content.shopifyUpdatedAt ?? "ukjent"}. Snake-innholdsobservasjon: ${content.contentObservedAt ?? "ukjent"}. Databaselagring: ${content.persistedAt ?? "ukjent"}. Variantsynkronisering: ${v.syncedAt ?? "ukjent"}. Hentet: ${d.generatedAt}.`);
    lines.push("Dette er siste vellykkede lagrede observasjoner, ikke nødvendigvis utfallet av siste oppdateringsforsøk. Ingen terskel for foreldelse er brukt.", SOURCE_SCOPE);
  } else if (field !== "collections") lines.push(`Siste vellykkede Snake-innholdsobservasjon: ${content.contentObservedAt ?? "ukjent"}. Dette er lagrede data, ikke live-verifisering.`);
  if (general || /kvalitet|god|dårlig|riktig|feil|relevan|optimaliser|rangering/iu.test(question)) lines.push(QUALITY_NOTE);
  return lines.join("\n\n");
}
