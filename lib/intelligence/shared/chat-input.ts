export const CHAT_LIMITS = {
  questionCharacters: 2_000,
  pageCharacters: 256,
  historyMessages: 8,
  historyMessageCharacters: 2_000,
} as const;

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type ValidChatInput = {
  question: string;
  page: string | null;
  history: ChatMessage[];
};

export type ChatInputResult =
  | { ok: true; value: ValidChatInput }
  | { ok: false; error: string };

export function validateChatInput(body: unknown): ChatInputResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalid("Ugyldig forespørsel.");
  }

  const input = body as Record<string, unknown>;
  const question = input.question;

  if (typeof question !== "string" || question.trim().length === 0) {
    return invalid("Mangler spørsmål.");
  }

  if (question.length > CHAT_LIMITS.questionCharacters) {
    return invalid(
      `Spørsmålet kan være maks ${CHAT_LIMITS.questionCharacters} tegn.`
    );
  }

  if (
    input.page !== undefined &&
    input.page !== null &&
    (typeof input.page !== "string" ||
      input.page.length > CHAT_LIMITS.pageCharacters)
  ) {
    return invalid("Ugyldig sidekontekst.");
  }

  const page = typeof input.page === "string" ? input.page : null;
  const history = input.history ?? [];

  if (!Array.isArray(history)) {
    return invalid("Ugyldig samtalehistorikk.");
  }

  if (history.length > CHAT_LIMITS.historyMessages) {
    return invalid(
      `Samtalehistorikken kan inneholde maks ${CHAT_LIMITS.historyMessages} meldinger.`
    );
  }

  const validatedHistory: ChatMessage[] = [];

  for (const message of history) {
    if (
      !message ||
      typeof message !== "object" ||
      Array.isArray(message)
    ) {
      return invalid("Ugyldig melding i samtalehistorikken.");
    }

    const candidate = message as Record<string, unknown>;

    if (
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      typeof candidate.text !== "string" ||
      candidate.text.length === 0 ||
      candidate.text.length > CHAT_LIMITS.historyMessageCharacters
    ) {
      return invalid("Ugyldig melding i samtalehistorikken.");
    }

    validatedHistory.push({
      role: candidate.role,
      text: candidate.text,
    });
  }

  return {
    ok: true,
    value: {
      question,
      page,
      history: validatedHistory,
    },
  };
}

function invalid(error: string): ChatInputResult {
  return { ok: false, error };
}
