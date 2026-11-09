import { isRoyEvidenceFollowUp } from "./follow-up.ts";
import { quoteRoyText as quote, quoteRoyProductName } from "./display-text.ts";
import { requestedContentField, type Phase2aContext } from "./phase2a-context.ts";
import { TARGET_FIELDS, type TargetField } from "./targeted-content-contract.ts";

const source = "Basert på sist lagrede katalogdata i Snake, ikke en ny kontroll i Shopify.";
const seoNote = "Tomme SEO-felt betyr ikke nødvendigvis manglende SEO. Shopify kan bruke standardverdier. Jeg har ikke kontrollert søkeresultater eller SEO-kvalitet.";
const imageNote = "En bildereferanse sier ikke noe om bildekvaliteten eller om bildelenken virker.";
const labels: Record<TargetField, string> = {
  productName: "Produktnavn", description: "Produktbeskrivelse", imageReference: "Bildereferanse",
  seoTitleOverride: "Egen SEO-tittel", seoDescriptionOverride: "Egen metabeskrivelse",
  productHandle: "Nettadresse-navn (handle)", productType: "Produkttype", shopifyCategory: "Shopify-kategori",
};

export function wantsRoyDetails(question: string) {
  return !question.trim() || isRoyEvidenceFollowUp(question) || /detalj|grundig|dokumentasjon|datagrunnlag|tidspunkt|oppdatert|synk|fersk|foreldet|dekning|komplett|alle felt/iu.test(question);
}
function fieldsFor(question: string, fallback: ReturnType<typeof requestedContentField>): TargetField[] {
  const fields: TargetField[] = [];
  if (/beskrivelse|produkttekst/iu.test(question) && !/metabeskrivelse|seo.?beskrivelse/iu.test(question)) fields.push("description");
  if (/bilde|image/iu.test(question)) fields.push("imageReference");
  if (fallback === "seo") fields.push("seoTitleOverride", "seoDescriptionOverride");
  else if (fallback && fallback !== "collections") fields.push(fallback);
  return [...new Set(fields)];
}

// Presentation only: callers validate the complete observation contract first.
export function presentConcisePhase2a(c: Exclude<Phase2aContext, { source: "roy_phase2a_guidance_v1" }>, question: string): string {
  const lines: string[] = [];
  if (c.source === "roy_catalog_foundation_v1") {
    const d = c.data;
    if (!d.totals.productCount) return `Det er ingen produkter i det tilgjengelige kataloggrunnlaget.\n\n${source}`;
    const fields = fieldsFor(question, c.field);
    if (c.field === "seo") lines.push("Jeg kan vise hvilke produkter som mangler egne SEO-felt, men ikke fastslå hvilke som «mangler SEO».");
    if (!fields.length && c.field !== "collections") lines.push(`Katalogen inneholder ${d.totals.productCount} aktive produkter og ${d.totals.variantCount} varianter.`);
    for (const field of fields) {
      const counts = d.fields[field === "seoTitleOverride" ? "seoTitle" : field === "seoDescriptionOverride" ? "seoDescription" : field];
      const optional = field.startsWith("seo") || field === "productType" || field === "shopifyCategory";
      if (field === "imageReference" && counts.missingCount === 0 && counts.unknownCount === 0) lines.push(`Ingen av de ${d.totals.productCount} produktene mangler bildereferanse.`);
      else lines.push(`${labels[field]}: ${counts.missingCount} produkter ${optional ? "har ikke fylt ut feltet" : "mangler feltet i de lagrede observasjonene"}.`);
      lines.push(`${counts.presentCount} har registrert verdi. ${counts.unknownCount ? `For ${counts.unknownCount} er status ukjent; de regnes ikke som manglende.` : "Ingen har ukjent status."}`);
    }
    if (c.field === "collections") {
      const m = d.collections;
      lines.push(`${m.completeWithZeroCollectionsCount} produkter er observert uten kolleksjoner; ${m.completeWithCollectionsCount} har medlemskap. For ${m.unknownOrIncompleteProductCount} er informasjonen ukjent eller ufullstendig.`);
    }
    const codes: Record<TargetField, string> = { productName: "missing_product_name", description: "missing_description", imageReference: "missing_image_reference", seoTitleOverride: "missing_seo_title", seoDescriptionOverride: "missing_seo_description", productHandle: "missing_product_handle", productType: "missing_product_type", shopifyCategory: "missing_shopify_category" };
    let remaining = 3;
    for (const field of fields) {
      const finding = d.findings.find(f => f.code === codes[field]);
      const examples = finding?.examples.slice(0, remaining) ?? [];
      if (examples.length) {
        lines.push(`Eksempler – ${labels[field].toLowerCase()} ikke utfylt: ${examples.map(e => `${quoteRoyProductName(e.productLabel)}${e.labelTruncated ? " (avkortet navn)" : ""}`).join(", ")}. Dette er et utvalg, ikke en fullstendig liste.`);
        remaining -= examples.length;
      }
    }
    if (fields.some(f => f.startsWith("seo"))) lines.push(seoNote);
    if (fields.includes("imageReference")) lines.push(imageNote);
    if (!fields.length && c.field !== "collections" && d.contentCoverage.unknownProductCount) lines.push(`Produktinnholdet er ukjent for ${d.contentCoverage.unknownProductCount} produkter.`);
  } else {
    const d = c.data;
    if (d.status === "ambiguous") return "SKU-en gir flere mulige variant-/produktidentiteter. Oppgi eksakt Shopify Variant-ID; jeg velger ikke et produkt på dine vegne.";
    if (d.status === "not_found") return `Jeg fant ikke produktreferansen i den aktive katalogen i Snake. Det betyr ikke at produktet mangler i Shopify.\n\n${source}`;
    const v = d.selectedVariant!;
    lines.push(`Jeg fant ${quoteRoyProductName(v.productName ?? "produktet")}${v.variantName ? `, variant ${quote(v.variantName)}` : ""}${v.sku ? ` (SKU ${quote(v.sku)})` : ""}.`);
    if (v.textTruncated) lines.push("Produktreferansen er avkortet eller tilbakeholdt; ikke bruk den som en ny eksakt SKU.");
    const topic = requestedContentField(question);
    const fields = fieldsFor(question, topic);
    const general = !fields.length && topic !== "collections";
    if (general) {
      lines.push(v.priceMinor !== null && v.currency ? `Variantpris: ${(v.priceMinor / 100).toLocaleString("nb-NO")} ${quote(v.currency)}.` : "Pris er ikke kjent.");
      lines.push(`${d.variantCount} aktive varianter. Be om detaljer for hele produktgrunnlaget.`);
    }
    for (const field of general ? TARGET_FIELDS.filter(f => ["description", "imageReference"].includes(f)) : fields) {
      const f = d.productContent!.fields[field];
      lines.push(`${labels[field]}: ${f.state === "unknown" ? "ukjent – ingen bekreftet observasjon" : f.state === "missing" ? "ikke utfylt i den lagrede observasjonen" : f.withheld ? "registrert, men verdien er tilbakeholdt" : general ? "registrert" : `${(field === "productName" ? quoteRoyProductName(f.value!) : quote(f.value!))}${f.truncated ? " (avkortet forhåndsvisning)" : ""}`}.`);
    }
    if (topic === "collections") {
      const m = d.canonicalCollections!;
      lines.push(m.state === "unknown_or_incomplete" ? "Informasjonen om kolleksjoner er ufullstendig; jeg kan ikke konkludere med at produktet har ingen kolleksjoner." : `${m.membershipCount} kolleksjoner: ${m.names.map(quote).join(", ") || "ingen"}.${m.displayTruncated ? " Navnelisten er avkortet." : ""}`);
    }
    if (fields.some(f => f.startsWith("seo"))) lines.push(seoNote);
    if (general || fields.includes("imageReference")) lines.push(imageNote);
    if (fields.includes("productHandle")) lines.push("Jeg har ikke kontrollert om den offentlige nettadressen virker.");
    if (fields.includes("shopifyCategory") || fields.includes("productType")) lines.push("Shopify-kategori og butikkens egen produkttype er separate felt.");
  }
  lines.push(source);
  return lines.join("\n\n");
}
