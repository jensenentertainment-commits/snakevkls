import type { ValidChatInput } from "../shared/chat-input.ts";
import { resolveMostRecentConversationReference } from "../shared/conversational-reference.ts";

export type RoyKnowledgeTopic =
  | "images"
  | "description"
  | "seo"
  | "capabilities";

export type RoyQueryIntent =
  | {
      readonly kind: "product";
      readonly sku: string;
      readonly reference: "explicit" | "conversation";
    }
  | {
      readonly kind: "catalog_filter";
      readonly filter:
        | { readonly type: "missing_product_type" }
        | { readonly type: "collection"; readonly value: string | null };
    }
  | {
      readonly kind: "catalog_overview";
      readonly objective: "overview" | "prioritize";
    }
  | {
      readonly kind: "knowledge_gap";
      readonly topics: readonly RoyKnowledgeTopic[];
    }
  | { readonly kind: "unresolved_reference" };

const SKU_PATTERN = /\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/gu;

export function resolveRoyQueryIntent(input: ValidChatInput): RoyQueryIntent {
  const question = input.question.trim();
  const topics = knowledgeTopics(question);
  if (topics.length) return { kind: "knowledge_gap", topics };

  const explicitSkus = extractSkus(question);
  if (explicitSkus.length === 1) {
    return { kind: "product", sku: explicitSkus[0], reference: "explicit" };
  }
  if (explicitSkus.length > 1) return { kind: "unresolved_reference" };

  if (/\b(dette|det|denne|den|produktet|varen)\b/iu.test(question)) {
    const reference = resolveMostRecentConversationReference({
      history: input.history,
      extract: extractSkus,
      key: (sku) => sku,
    });
    if (reference.status === "resolved") {
      return {
        kind: "product",
        sku: reference.value,
        reference: "conversation",
      };
    }
    return { kind: "unresolved_reference" };
  }

  if (
    /\b(mangler|uten|ikke\s+registrert)\b[\s\S]*\b(product\s*type|produkttype)\b/iu.test(question) ||
    /\b(product\s*type|produkttype)\b[\s\S]*\b(mangler|uten|ikke\s+registrert)\b/iu.test(question)
  ) {
    return { kind: "catalog_filter", filter: { type: "missing_product_type" } };
  }

  if (/\b(collection|collections|kolleksjon|kolleksjoner)\b/iu.test(question)) {
    return {
      kind: "catalog_filter",
      filter: { type: "collection", value: collectionValue(question) },
    };
  }

  if (/\b(prioriter|prioritere|prioritet|viktigst|først)\b/iu.test(question)) {
    return { kind: "catalog_overview", objective: "prioritize" };
  }

  return { kind: "catalog_overview", objective: "overview" };
}

function extractSkus(text: string) {
  return [...new Set(text.match(SKU_PATTERN) ?? [])];
}

function knowledgeTopics(question: string): RoyKnowledgeTopic[] {
  if (
    /\b(hva|hvilken|hvilke)\b[\s\S]*\b(mangler|trenger|tilgjengelig|tilgang)\b[\s\S]*\b(du|roy|informasjon|data|jobben)\b/iu.test(question) ||
    /\b(capabilit|kapabilitet|kunnskapshull|datagrunnlag)\b/iu.test(question)
  ) {
    return ["capabilities"];
  }

  const topics: RoyKnowledgeTopic[] = [];
  if (/\b(bilde|bilder|bildegalleri)\b/iu.test(question)) topics.push("images");
  if (/\b(beskrivelse|produktbeskrivelse|produkttekst)\b/iu.test(question)) topics.push("description");
  if (/\bseo|metatittel|metabeskrivelse\b/iu.test(question)) topics.push("seo");
  return topics;
}

function collectionValue(question: string) {
  if (/\bavada\b/iu.test(question)) return "AVADA";
  const quoted = /["“]([^"”]{2,80})["”]/u.exec(question)?.[1];
  return quoted?.trim() ?? null;
}
