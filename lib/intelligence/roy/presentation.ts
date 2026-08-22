import type {
  RoyReceivedCatalogField,
  ShopifyCatalogContext,
  ShopifyCatalogProduct,
} from "../workforce/contexts/shopify-catalog";
import { enforceRoyContentContract } from "./content-contract.ts";

const UNKNOWN_TOPICS = [
  { pattern: /\b(bilde|bilder|bildegalleri)\b/iu, label: "bilder" },
  { pattern: /\b(beskrivelse|produktbeskrivelse|produkttekst)\b/iu, label: "produktbeskrivelse" },
  { pattern: /\bseo|metatittel|metabeskrivelse\b/iu, label: "SEO" },
] as const;

export function createRoyUserResponse(input: {
  internalAnswer: string;
  context: ShopifyCatalogContext;
  question: string;
}) {
  // The strict evidence contract always runs before presentation. The public
  // response is then built only from the same authoritative received context.
  enforceRoyContentContract(input.internalAnswer, input.context);
  return presentContext(input.context, input.question);
}

function presentContext(context: ShopifyCatalogContext, question: string) {
  if (context.intent.kind === "knowledge_gap") {
    return presentKnowledgeGap(context.intent.topics);
  }
  if (context.intent.kind === "unresolved_reference") {
    return "Jeg klarer ikke å avgjøre hvilket produkt du viser til. Oppgi SKU-en, så undersøker jeg riktig produkt uten å gjette.";
  }
  if (context.intent.kind === "catalog_overview" && context.audit) {
    return presentAudit(context.audit, context.intent.objective);
  }
  if (context.audit && context.auditSelection) {
    return presentSelectedAudit(context);
  }
  if (context.products.length === 0) {
    if (
      context.intent.kind === "catalog_filter" &&
      context.intent.filter.type === "missing_product_type"
    ) {
      return "Jeg fant ingen aktive, synkroniserte produkter med eksplisitt manglende produkttype i dette søket.";
    }
    if (
      context.intent.kind === "catalog_filter" &&
      context.intent.filter.type === "collection"
    ) {
      const collection = context.intent.filter.value;
      return collection
        ? `Jeg fant ingen aktive, synkroniserte produkter i collections som matcher «${collection}».`
        : "Jeg fant ingen aktive, synkroniserte produkter med registrerte collections i dette søket.";
    }
    return context.query
      ? `Jeg fant ingen produkter i det avgrensede katalogutvalget for «${context.query}». Jeg kan derfor ikke vurdere spørsmålet ut fra dataene jeg har.`
      : "Jeg fant ingen produkter i det avgrensede katalogutvalget og kan derfor ikke vurdere spørsmålet ut fra dataene jeg har.";
  }

  const products = context.products.slice(0, 8);
  if (context.intent.kind === "catalog_overview" && context.intent.objective === "prioritize") {
    return presentPriorities(products, context).join("\n\n");
  }
  const detailed = products.length === 1;
  const lines = detailed
    ? presentSingleProduct(products[0], context, question)
    : presentProductSet(products, context, question);
  const unknown = presentUnknownTopics(context, question, detailed);
  if (unknown) lines.push(unknown);
  if (context.products.length > products.length) {
    lines.push(`Jeg viser de første ${products.length} av ${context.products.length} treff i dette utvalget.`);
  }
  return lines.join("\n\n");
}

function presentSingleProduct(
  product: ShopifyCatalogProduct,
  context: ShopifyCatalogContext,
  question: string,
) {
  const lines = [`Jeg fant ${productLabel(product)}.`];
  const general = /\b(hva kan|fortell|oversikt|oppsummer|vurder produkt)\b/iu.test(question);
  const auditsProblems = /\b(problem|problemer|mangler|mangel|avvik)\b/iu.test(question);
  const facts: string[] = [];

  if (/\b(variant|variantnavn)\b/iu.test(question) && product.variantName) {
    lines.push(`SKU-en viser til varianten «${product.variantName}» av produktet.`);
  }

  if (general || /\bpris|kost(?:er|nad)\b/iu.test(question)) {
    const price = presentPrice(product, context.receivedFields);
    if (price) facts.push(`koster ${price}`);
  }
  if (general || /\b(lager|lagerantall|antall|beholdning)\b/iu.test(question)) {
    const quantity = presentQuantity(product, context.receivedFields);
    if (quantity) facts.push(quantity);
  }
  if (general || /\bstatus|aktiv|utkast|arkivert|publisert\b/iu.test(question)) {
    const status = presentStatus(product, context.receivedFields);
    if (status) facts.push(status);
  }
  if (facts.length) lines.push(sentenceFromFacts(facts));
  if (/\b(synk\w*|oppdatert|fersk|freshness)\b/iu.test(question) && product.syncedAt) {
    lines.push(`Snake observerte katalogdataene sist ${formatTimestamp(product.syncedAt)}.`);
  }
  if (/\b(?:bilde\w*|bildereferanse|featured-image(?:-referanse)?|image\s*reference)\b/iu.test(question)) {
    lines.push(product.imageReference
      ? "Snake har en featured-image-referanse for produktet. Det sier ikke noe om bildekvaliteten."
      : "Featured-image-referansen er eksplisitt tom i den mottatte Snake-konteksten. Det sier ikke noe om andre bilder eller bildekvalitet.");
  }

  if (general || /\b(collection|collections|kolleksjon)\b/iu.test(question)) {
    const collections = presentCollections(product, context.receivedFields);
    if (collections) lines.push(collections);
    if (
      /\bavada\b/iu.test(question) &&
      /\b(feil|intern|kundesynlig|fjerne|fjernes|skjule|skjules)\b/iu.test(question)
    ) {
      lines.push("Collection-navnene alene dokumenterer ikke om de er interne, feil eller synlige for kunder. Derfor kan jeg ikke anbefale å fjerne dem uten et direkte datagrunnlag for det.");
    }
  }
  if (auditsProblems) {
    lines.push(presentObservedProblems(product, context.receivedFields));
  } else if (general || /\b(product\s*type|produkttype|kategori|kategorisert)\b/iu.test(question)) {
    lines.push(presentProductType(product, context.receivedFields, question));
  }
  return lines;
}

function presentSelectedAudit(context: ShopifyCatalogContext) {
  const audit = context.audit!;
  const finding = audit.findings.find(({ code }) => code === context.auditSelection);
  const count = finding?.count ?? 0;
  const scope = finding?.scope ?? "product";
  const total = scope === "variant" ? audit.variantCount : audit.productCount;
  const labels: Record<NonNullable<ShopifyCatalogContext["auditSelection"]>, string> = {
    missing_product_type: "mangler produkttype",
    missing_vendor: "mangler leverandør",
    missing_featured_image_reference: "mangler featured-image-referanse i Snake",
    missing_sku: "mangler SKU",
    inconsistent_product_fields: "har inkonsistente produktfelt på tvers av varianter",
    exact_duplicate_product_name: "er eksakte duplikatkandidater basert på produktnavn",
  };
  const entity = scope === "variant" ? "varianter" : "produkter";
  const lines = [`Den produktbaserte auditen viser at ${count} av ${total} ${entity} ${labels[context.auditSelection!]}.`];
  if (context.products.length) {
    lines.push("Et begrenset evidensutvalg:", ...context.products.slice(0, 8).map((product) => `- ${productLabel(product)}.`));
  }
  lines.push("Utvalget over er evidens, ikke totalresultatet.");
  return lines.join("\n");
}

function presentObservedProblems(
  product: ShopifyCatalogProduct,
  receivedFields: readonly RoyReceivedCatalogField[],
) {
  const missing: string[] = [];
  if (receivedFields.includes("sku") && isExplicitlyEmpty(product.sku)) missing.push("SKU");
  if (receivedFields.includes("vendor") && isExplicitlyEmpty(product.vendor)) missing.push("leverandør");
  if (receivedFields.includes("productType") && isExplicitlyEmpty(product.productType)) missing.push("produkttype");
  if (
    receivedFields.includes("priceMinor") &&
    receivedFields.includes("currency") &&
    (product.priceMinor === null || isExplicitlyEmpty(product.currency))
  ) missing.push("pris");
  if (receivedFields.includes("quantity") && product.quantity === null) missing.push("lagerantall");
  if (receivedFields.includes("status") && isExplicitlyEmpty(product.status)) missing.push("produktstatus");
  if (receivedFields.includes("collections") && product.collections.length === 0) missing.push("collections");

  if (missing.length) {
    return `Jeg kan bekrefte at ${naturalList(missing)} ikke er registrert i den mottatte katalogkonteksten.`;
  }
  return "Jeg fant ingen eksplisitt tomme verdier i katalogfeltene jeg mottok. Det dokumenterer ikke at produktet er problemfritt på områder jeg ikke har data om.";
}

function presentProductSet(
  products: readonly ShopifyCatalogProduct[],
  context: ShopifyCatalogContext,
  question: string,
) {
  if (context.intent.kind === "catalog_overview" && context.intent.objective === "prioritize") {
    return presentPriorities(products, context);
  }
  if (context.intent.kind === "catalog_filter") {
    if (context.intent.filter.type === "missing_product_type") {
      return [
        `Jeg fant ${products.length} produkter med eksplisitt manglende produkttype i det avgrensede resultatet:`,
        ...products.map((product) => `- ${productLabel(product)}.`),
      ];
    }
    return presentCollectionProducts(products, context.intent.filter.value);
  }
  const asksProductType = /\b(product\s*type|produkttype|kategori|kategorisert)\b/iu.test(question);
  const lines = [`Jeg fant ${products.length} produkter i det avgrensede utvalget.`];
  if (asksProductType) {
    const missing = products.filter((product) => isExplicitlyEmpty(product.productType));
    if (missing.length === products.length) {
      lines.push("Produkttype mangler på alle produktene i utvalget. Uten registrert produkttype og en godkjent taksonomi kan jeg ikke fastslå hvilke som er feil kategorisert.");
    } else if (missing.length) {
      lines.push(`Produkttype mangler på ${missing.length} av ${products.length} produkter: ${missing.map(productLabel).join(", ")}. Jeg kan ikke fastslå om de øvrige er riktig kategorisert uten en godkjent taksonomi.`);
    } else {
      lines.push("Alle produktene har en registrert produkttype, men jeg kan ikke fastslå om typene er riktige uten en godkjent taksonomi.");
    }
    return lines;
  }

  lines.push(
    ...products.map((product) => {
      const details = [
        presentPrice(product, context.receivedFields),
        presentQuantity(product, context.receivedFields),
        presentStatus(product, context.receivedFields),
      ].filter((value): value is string => Boolean(value));
      return `- ${productLabel(product)}${details.length ? `: ${details.join(", ")}` : ""}.`;
    }),
  );
  return lines;
}

function presentKnowledgeGap(topics: readonly string[]) {
  if (topics.includes("capabilities")) {
    return "Jeg kan arbeide med produkter, varianter, SKU, leverandør, produkttype, pris, lagerantall, produktstatus, collections, synkroniseringstid og om Snake har en featured-image-referanse. Bildereferansen gir ikke grunnlag for å vurdere bildekvalitet. Jeg mangler beskrivelse og SEO-data, og har heller ikke live Shopify-data eller en godkjent produkttaksonomi.";
  }
  const labels = topics.map((topic) => ({
    images: "bilder",
    description: "produktbeskrivelse",
    seo: "SEO",
  })[topic] ?? topic);
  return `Jeg har ikke data om ${naturalList(labels)} i Roy v1. Derfor kan jeg ikke avgjøre hvilke produkter som mangler dette, vurdere kvaliteten eller anbefale tiltak ut fra dagens datagrunnlag.`;
}

function presentCollectionProducts(
  products: readonly ShopifyCatalogProduct[],
  collectionValue: string | null,
) {
  const lines = [
    collectionValue
      ? `Jeg fant ${products.length} produkter i collections som matcher «${collectionValue}».`
      : `Jeg fant ${products.length} produkter med registrerte collections i det avgrensede resultatet.`,
  ];
  lines.push(
    ...products.map((product) => {
      const collections = product.collections.map(({ title }) => title);
      return `- ${productLabel(product)}${collections.length ? `: ${naturalList(collections)}` : ""}.`;
    }),
  );
  if (collectionValue?.toLowerCase() === "avada") {
    lines.push("Collection-navnene alene dokumenterer ikke om de er interne, feil eller synlige for kunder. Derfor kan jeg ikke anbefale å fjerne dem uten et direkte datagrunnlag for det.");
  }
  return lines;
}

function presentPriorities(
  products: readonly ShopifyCatalogProduct[],
  context: ShopifyCatalogContext,
) {
  const missingProductType = products.filter((product) => isExplicitlyEmpty(product.productType));
  const missingVendor = products.filter((product) => isExplicitlyEmpty(product.vendor));
  const withoutCollections = products.filter((product) => product.collections.length === 0);
  const priorities = [
    missingProductType.length
      ? `${productCount(missingProductType.length)} mangler produkttype`
      : "ingen produkter mangler produkttype",
    missingVendor.length
      ? `${productCount(missingVendor.length)} mangler leverandør`
      : "ingen produkter mangler leverandør",
    withoutCollections.length
      ? `${productCount(withoutCollections.length)} har ingen registrerte collections`
      : "alle produktene har minst én registrert collection",
  ];
  return [
    `I det avgrensede utvalget på ${products.length} produkter ville jeg startet med bekreftede datamangler: ${priorities.join(", ")}.`,
    `Dette er en datakvalitetsprioritering innen de ${context.receivedFields.length} feltene jeg har mottatt, ikke en kommersiell prioritering av hele katalogen.`,
  ];
}

function presentAudit(audit: NonNullable<ShopifyCatalogContext["audit"]>, objective: "overview" | "prioritize") {
  const labels: Record<string, string> = {
    missing_product_type: "mangler produkttype",
    missing_vendor: "mangler leverandør",
    missing_featured_image_reference: "mangler featured-image-referanse i Snake",
    missing_sku: "mangler SKU",
    inconsistent_product_fields: "har inkonsistente produktfelt på tvers av varianter",
    exact_duplicate_product_name: "er eksakte duplikatkandidater basert på produktnavn",
  };
  const findings = audit.findings.map((finding) => `- ${finding.count} ${finding.scope === "variant" ? "varianter" : "produkter"} ${labels[finding.code]}.`).join("\n");
  const intro = objective === "prioritize"
    ? `Jeg ville startet med de deterministisk dokumenterte datamanglene i katalogen. Auditen omfatter ${audit.productCount} produkter og ${audit.variantCount} varianter.`
    : `Den deterministiske auditen omfatter ${audit.productCount} produkter og ${audit.variantCount} varianter.`;
  const freshness = audit.freshness.oldestSyncedAt && audit.freshness.newestSyncedAt
    ? `Synkroniseringene i utvalget går fra ${formatTimestamp(audit.freshness.oldestSyncedAt)} til ${formatTimestamp(audit.freshness.newestSyncedAt)}. Jeg klassifiserer ikke noe som foreldet uten en godkjent terskel.`
    : "Jeg har ikke nok synkroniseringstidspunkter til å beskrive ferskheten.";
  return [intro, findings || "Jeg fant ingen av de implementerte deterministiske avvikene.", freshness, "Dette er datakvalitetsfunn, ikke en kommersiell prioritering eller faglig produkttaksonomi."].join("\n\n");
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Oslo" }).format(date);
}

function productCount(count: number) {
  return `${count} ${count === 1 ? "produkt" : "produkter"}`;
}

function presentUnknownTopics(
  context: ShopifyCatalogContext,
  question: string,
  includeForGeneralQuestion: boolean,
) {
  const general = includeForGeneralQuestion && /\b(hva kan|fortell|oversikt|oppsummer)\b/iu.test(question);
  const unknown = UNKNOWN_TOPICS.filter(
    ({ pattern }) => pattern.test(question) || general,
  ).filter(({ label }) => !context.receivedFields.includes(label as RoyReceivedCatalogField));
  if (!unknown.length) return "";
  const topics = naturalList(unknown.map(({ label }) => label));
  return `Jeg har ikke data om ${topics} i denne analysen, så det kan jeg ikke vurdere eller anbefale tiltak for.`;
}

function presentPrice(
  product: ShopifyCatalogProduct,
  receivedFields: readonly RoyReceivedCatalogField[],
) {
  if (
    !receivedFields.includes("priceMinor") ||
    !receivedFields.includes("currency") ||
    product.priceMinor === null ||
    !product.currency
  ) return "";
  const amount = product.priceMinor / 100;
  if (product.currency.toUpperCase() === "NOK") {
    return `${new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(amount)} kr`;
  }
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: product.currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function presentQuantity(
  product: ShopifyCatalogProduct,
  receivedFields: readonly RoyReceivedCatalogField[],
) {
  if (!receivedFields.includes("quantity") || product.quantity === null) return "";
  return `${new Intl.NumberFormat("nb-NO").format(product.quantity)} stk. på lager`;
}

function presentStatus(
  product: ShopifyCatalogProduct,
  receivedFields: readonly RoyReceivedCatalogField[],
) {
  if (!receivedFields.includes("status") || !product.status) return "";
  const statuses: Record<string, string> = {
    ACTIVE: "aktivt",
    DRAFT: "et utkast",
    ARCHIVED: "arkivert",
  };
  return statuses[product.status.toUpperCase()] ?? `har status «${product.status}»`;
}

function presentCollections(
  product: ShopifyCatalogProduct,
  receivedFields: readonly RoyReceivedCatalogField[],
) {
  if (!receivedFields.includes("collections")) return "";
  if (product.collections.length === 0) return "Ingen kolleksjoner er registrert på produktet.";
  return `Produktet ligger i ${naturalList(product.collections.map(({ title }) => title))}.`;
}

function presentProductType(
  product: ShopifyCatalogProduct,
  receivedFields: readonly RoyReceivedCatalogField[],
  question: string,
) {
  if (!receivedFields.includes("productType")) {
    return "Jeg har ikke produkttype i denne analysen og kan derfor ikke vurdere kategoriseringen.";
  }
  if (isExplicitlyEmpty(product.productType)) {
    return /\b(riktig|feil|kategori|kategorisert)\b/iu.test(question)
      ? "Produkttype er ikke registrert. Derfor kan jeg ikke fastslå om produktet er riktig kategorisert."
      : "Én konkret katalogmangel jeg kan bekrefte er at produkttype ikke er registrert.";
  }
  if (/\b(riktig|feil|kategori|kategorisert)\b/iu.test(question)) {
    return `Produkttypen er registrert som «${product.productType}». Jeg kan ikke fastslå om den er riktig uten en godkjent taksonomi.`;
  }
  return `Produkttypen er registrert som «${product.productType}».`;
}

function sentenceFromFacts(facts: readonly string[]) {
  const sentence = naturalList(facts);
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

function naturalList(items: readonly string[]) {
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} og ${items.at(-1)}`;
}

function productLabel(product: ShopifyCatalogProduct) {
  const name = product.productName.replace(/[.\s]+$/u, "");
  return product.sku ? `${name} (SKU ${product.sku})` : name;
}

function isExplicitlyEmpty(value: unknown) {
  return value === null || value === "" || (Array.isArray(value) && value.length === 0);
}
