import type {
  RoyReceivedCatalogField,
  ShopifyCatalogContext,
  ShopifyCatalogProduct,
} from "../workforce/contexts/shopify-catalog";
import { enforceRoyContentContract } from "./content-contract.ts";

const UNKNOWN_TOPICS = [
  { pattern: /\b(bilde|bilder|bildegalleri)\b/iu, label: "bilder" },
  { pattern: /\b(beskrivelse|produkttekst)\b/iu, label: "produktbeskrivelse" },
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
  if (context.products.length === 0) {
    return context.query
      ? `Jeg fant ingen produkter i det avgrensede katalogutvalget for «${context.query}». Jeg kan derfor ikke vurdere spørsmålet ut fra dataene jeg har.`
      : "Jeg fant ingen produkter i det avgrensede katalogutvalget og kan derfor ikke vurdere spørsmålet ut fra dataene jeg har.";
  }

  const products = context.products.slice(0, 8);
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
  const facts: string[] = [];

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

  if (general || /\b(collection|collections|kolleksjon)\b/iu.test(question)) {
    const collections = presentCollections(product, context.receivedFields);
    if (collections) lines.push(collections);
  }
  if (general || /\b(product\s*type|produkttype|kategori|kategorisert)\b/iu.test(question)) {
    lines.push(presentProductType(product, context.receivedFields, question));
  }
  return lines;
}

function presentProductSet(
  products: readonly ShopifyCatalogProduct[],
  context: ShopifyCatalogContext,
  question: string,
) {
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
