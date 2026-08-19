import type { ValidChatInput } from "../shared/chat-input";
import type { ShopifyCatalogContext } from "../workforce/contexts/shopify-catalog";

export function buildRoyModelInput(input: {
  systemPrompt: string;
  context: ShopifyCatalogContext;
  history: ValidChatInput["history"];
  question: string;
}) {
  return [
    { role: "system" as const, content: input.systemPrompt },
    { role: "system" as const, content: `# Katalogutvalg\n${JSON.stringify(input.context)}` },
    ...input.history.map((message) => ({ role: message.role, content: message.text })),
    { role: "user" as const, content: input.question },
  ];
}
