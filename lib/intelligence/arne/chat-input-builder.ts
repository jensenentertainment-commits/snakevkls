import type { ChatMessage } from "../shared/chat-input";
import type { ArneAdvisoryContext } from "../workforce/contexts/arne-advisory-context";

export type ArneModelMessage = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

export function buildArneModelInput(input: {
  readonly systemPrompt: string;
  readonly context: ArneAdvisoryContext;
  readonly history: readonly ChatMessage[];
  readonly question: string;
}): ArneModelMessage[] {
  return [
    { role: "system", content: input.systemPrompt },
    {
      role: "user",
      content: formatArneBackgroundContext(input.context),
    },
    ...input.history.map((message) => ({
      role: message.role,
      content: message.text,
    })),
    { role: "user", content: input.question },
  ];
}

export function formatArneBackgroundContext(context: ArneAdvisoryContext) {
  return `
Dette er bakgrunnsinformasjon om Snake.
Den skal bare brukes når den er relevant for admins spørsmål.
Ikke analyser eller foreslå tiltak utelukkende fordi informasjonen finnes her.

=== Snake Knowledge ===

${context.snakeKnowledge}

=== Development Context ===

${JSON.stringify(context.developmentContext, null, 2)}

=== Operational Context ===

${JSON.stringify(context.operationalContext, null, 2)}

=== Current Page ===

${context.page ?? "ukjent"}
`;
}
