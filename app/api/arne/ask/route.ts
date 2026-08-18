import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getArneDevelopmentContext } from "@/lib/intelligence/arne/development-context";
import { getArneSystemPrompt } from "@/lib/intelligence/arne/system";
import { buildSnakeKnowledgePrompt } from "@/lib/intelligence/shared/build-snake-knowledge";
import { validateChatInput } from "@/lib/intelligence/shared/chat-input";
import {
  CHAT_MODEL,
  chatInputError,
  chatServerError,
  getChatOpenAIClient,
  logChatServerError,
} from "@/lib/intelligence/shared/chat-server";
import { getSnakeOperationalContext } from "@/lib/intelligence/shared/operational-context";

export async function POST(req: Request) {
  try {
    const auth = await requireRole(["admin"]);
    if (!auth.ok) return auth.response;

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return chatInputError("Forespørselen må inneholde gyldig JSON.");
    }

    const input = validateChatInput(body);
    if (!input.ok) return chatInputError(input.error);

    const { question, page, history } = input.value;
    const conversation = history.map((message) => ({
      role: message.role,
      content: message.text,
    }));

    let snakeKnowledge: string;
    let snakeContext: Awaited<ReturnType<typeof getSnakeOperationalContext>>;
    let developmentContext: ReturnType<typeof getArneDevelopmentContext>;

    try {
      snakeKnowledge = buildSnakeKnowledgePrompt();
      snakeContext = await getSnakeOperationalContext();
      developmentContext = getArneDevelopmentContext();
    } catch (error) {
      logChatServerError("arne", "context", error);
      return chatServerError();
    }

    try {
      const response = await getChatOpenAIClient().responses.create({
        model: CHAT_MODEL,
        input: [
          {
            role: "system",
            content: getArneSystemPrompt(),
          },
          {
            role: "user",
            content: `
Dette er bakgrunnsinformasjon om Snake.
Den skal bare brukes når den er relevant for admins spørsmål.
Ikke analyser eller foreslå tiltak utelukkende fordi informasjonen finnes her.

=== Snake Knowledge ===

${snakeKnowledge}

=== Development Context ===

${JSON.stringify(developmentContext, null, 2)}

=== Operational Context ===

${JSON.stringify(snakeContext, null, 2)}

=== Current Page ===

${page ?? "ukjent"}
`,
          },
          ...conversation,
          {
            role: "user",
            content: question,
          },
        ],
      });

      return NextResponse.json({
        answer:
          response.output_text ||
          "Arne fikk ikke svart. Det er irriterende, men teknisk mulig.",
      });
    } catch (error) {
      logChatServerError("arne", "openai", error);
      return chatServerError();
    }
  } catch (error) {
    logChatServerError("arne", "unexpected", error);
    return chatServerError();
  }
}
