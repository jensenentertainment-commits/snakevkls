import type { ChatMessage } from "./chat-input.ts";

export const CONVERSATIONAL_REFERENCE_PRINCIPLE =
  "Resolve bounded conversation references before selecting domain context; clarify ambiguity instead of silently widening context.";

export type ConversationReferenceResolution<T> =
  | { readonly status: "resolved"; readonly value: T }
  | { readonly status: "missing" }
  | { readonly status: "ambiguous" };

export function resolveMostRecentConversationReference<T>(input: {
  readonly history: readonly ChatMessage[];
  readonly extract: (text: string) => readonly T[];
  readonly key: (value: T) => string;
}): ConversationReferenceResolution<T> {
  for (const role of ["user", "assistant"] as const) {
    for (const message of [...input.history].reverse()) {
      if (message.role !== role) continue;
      const unique = new Map(
        input.extract(message.text).map((value) => [input.key(value), value]),
      );
      if (unique.size === 1) {
        return { status: "resolved", value: [...unique.values()][0] };
      }
      if (unique.size > 1) return { status: "ambiguous" };
    }
  }
  return { status: "missing" };
}
