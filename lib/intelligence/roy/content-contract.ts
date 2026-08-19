import type {
  RoyReceivedCatalogField,
  ShopifyCatalogContext,
  ShopifyCatalogProduct,
} from "../workforce/contexts/shopify-catalog";

const HEADINGS = ["OBSERVED", "UNKNOWN", "INFERENCE"] as const;
const MISSING_WORDS = /\b(mangler|manglende|tomt|tom|blank|null)\b/iu;
const FIELD_REFERENCE = /^- \[field=([^\]]+)\]/u;
const INFERENCE_REFERENCE = /^- \[based_on=([^\]]+)\]/u;
const GENERAL_ADVICE_OR_OUTCOME =
  /\b(bør|anbefal|best practice|publiseringsklar|konvertering|salgbar|synlighet|google shopping|produktfeed|shopify-problem)\b/iu;

const UNAVAILABLE_FIELD_TERMS: ReadonlyArray<{
  field: string;
  terms: RegExp;
}> = [
  { field: "description", terms: /\b(beskrivelse|produkttekst|description)\b/iu },
  { field: "images", terms: /\b(bilde|bilder|bildegalleri|image|images)\b/iu },
  { field: "seo", terms: /\b(seo|metatittel|metabeskrivelse|meta title|meta description)\b/iu },
  { field: "handle", terms: /\b(handle|url)\b/iu },
  { field: "barcode", terms: /\b(gtin|ean|upc|strekkode|barcode)\b/iu },
  { field: "attributes", terms: /\b(vekt|dimensjon|materiale|farge|attributt)\b/iu },
];

export function enforceRoyContentContract(
  answer: string,
  context: ShopifyCatalogContext,
): string {
  return isRoyAnswerValid(answer, context)
    ? answer
    : buildSafeRoyFallback(context);
}

export function isRoyAnswerValid(
  answer: string,
  context: ShopifyCatalogContext,
): boolean {
  const sections = parseSections(answer);
  if (!sections) return false;

  for (const line of sections.OBSERVED) {
    const match = FIELD_REFERENCE.exec(line);
    if (!match || !isReceivedField(match[1], context)) return false;
    const field = match[1] as RoyReceivedCatalogField;
    if (MISSING_WORDS.test(line) && !isExplicitlyEmpty(field, context.products)) {
      return false;
    }
    if (
      mentionsUnavailableField(line, context) ||
      GENERAL_ADVICE_OR_OUTCOME.test(line)
    ) {
      return false;
    }
  }

  for (const line of sections.INFERENCE) {
    if (line === "- Ingen.") continue;
    const match = INFERENCE_REFERENCE.exec(line);
    if (!match) return false;
    const fields = match[1].split(",").map((field) => field.trim());
    if (
      fields.length === 0 ||
      fields.some((field) => !isReceivedField(field, context)) ||
      mentionsUnavailableField(line, context) ||
      GENERAL_ADVICE_OR_OUTCOME.test(line)
    ) {
      return false;
    }
  }

  return sections.UNKNOWN.every((line) => line.startsWith("- "));
}

function parseSections(answer: string) {
  const sections: Record<(typeof HEADINGS)[number], string[]> = {
    OBSERVED: [],
    UNKNOWN: [],
    INFERENCE: [],
  };
  let current: (typeof HEADINGS)[number] | null = null;
  const seen: string[] = [];

  for (const rawLine of answer.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (HEADINGS.includes(line as (typeof HEADINGS)[number])) {
      current = line as (typeof HEADINGS)[number];
      seen.push(line);
      continue;
    }
    if (!current || !line.startsWith("- ")) return null;
    sections[current].push(line);
  }

  if (
    seen.length !== HEADINGS.length ||
    !HEADINGS.every((heading, index) => seen[index] === heading) ||
    HEADINGS.some((heading) => sections[heading].length === 0)
  ) {
    return null;
  }
  return sections;
}

function isReceivedField(
  field: string,
  context: ShopifyCatalogContext,
): field is RoyReceivedCatalogField {
  return context.receivedFields.includes(field as RoyReceivedCatalogField);
}

function isExplicitlyEmpty(
  field: RoyReceivedCatalogField,
  products: readonly ShopifyCatalogProduct[],
) {
  return products.some((product) => {
    const value = product[field];
    return (
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    );
  });
}

function mentionsUnavailableField(
  line: string,
  context: ShopifyCatalogContext,
) {
  return UNAVAILABLE_FIELD_TERMS.some(
    ({ field, terms }) =>
      !context.receivedFields.includes(field as RoyReceivedCatalogField) &&
      terms.test(line),
  );
}

function buildSafeRoyFallback(context: ShopifyCatalogContext) {
  const observed = context.products.length
    ? context.products.slice(0, 8).flatMap((product) => {
        const sku = product.sku ?? "uten SKU";
        return context.receivedFields.map((field) => {
          const value = product[field];
          const rendered =
            value === null || value === ""
              ? "MISSING (eksplisitt tom/null)"
              : Array.isArray(value)
                ? value.length
                  ? value.map((item) => item.title).join(", ")
                  : "MISSING (eksplisitt tom liste)"
                : String(value);
          return `- [field=${field}] ${sku} — ${field}: ${rendered}.`;
        });
      })
    : ["- [field=sku] Ingen produkter traff det avgrensede katalogutvalget."];

  return [
    "OBSERVED",
    ...observed,
    "UNKNOWN",
    "- Felt og temaer utenfor receivedFields er ikke tilgjengelige i denne konteksten og kan ikke vurderes.",
    "INFERENCE",
    "- Ingen.",
  ].join("\n");
}
