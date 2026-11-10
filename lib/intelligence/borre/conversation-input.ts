import type { ChatMessage } from "../shared/chat-input.ts";
import type { BorreConversationContext } from "./conversation-answer.ts";

export function buildBorreConversationInput(input: { systemPrompt: string; context: BorreConversationContext; history: readonly ChatMessage[]; question: string }) {
  // Grounded stock answers bypass generation. General questions receive no historical stock facts.
  return [
    { role: "system" as const, content: input.systemPrompt },
    { role: "system" as const, content: "Svar bare på det aktuelle, generelle spørsmålet. Forklar begrepet direkte uten å innlede med manglende lagerobservasjoner og uten å be om identitet når det ikke trengs. Ingen lagerobservasjoner er hentet. Ikke oppgi lagerstatus, tall eller synkstatus fra hukommelse. Ikke tilby reserveringsdata, fysiske tellinger eller handlinger. Ved behov for et oppslag støttes produktnavn, produkt-UUID, Shopify Variant-ID eller lokasjonskode; aldri SKU som entydig nøkkel. Konkrete oppfølginger er håndtert separat av leserutingen." },
    { role: "user" as const, content: input.question },
  ];
}

export async function respondBorre(context: BorreConversationContext, generate: () => Promise<string>) {
  if (context.answer !== null) return context.answer;
  const answer = (await generate()).trim();
  // AskBorre sends the last eight messages; each must fit the existing shared 2,000-char contract.
  return answer.length <= 1900 ? answer : `${answer.slice(0, 1800)}…\nJeg kan utdype et konkret punkt.`;
}
