import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getBorreContext } from "@/lib/intelligence/borre/shared-context";
import { getBorreDevelopmentContext } from "@/lib/intelligence/borre/development-context";
import { getArneSystemPrompt } from "@/lib/intelligence/arne/system";
import { buildSnakeKnowledgePrompt } from "@/lib/intelligence/shared/build-snake-knowledge";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Ikke innlogget" },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Kunne ikke kontrollere Arne-tilgang:", profileError);

    return NextResponse.json(
      { error: "Kunne ikke kontrollere tilgang." },
      { status: 500 }
    );
  }

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Kun administrator har tilgang til Arne." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { question, page, history = [] } = body;

  if (!question || typeof question !== "string") {
    return NextResponse.json(
      { error: "Mangler spørsmål" },
      { status: 400 }
    );
  }



  const conversation = Array.isArray(history)
    ? history
        .slice(-8)
        .filter(
          (message): message is ChatMessage =>
            message !== null &&
            typeof message === "object" &&
            (message.role === "user" ||
              message.role === "assistant") &&
            typeof message.text === "string"
        )
        .map((message) => ({
          role: message.role,
          content: message.text,
        }))
    : [];

  const snakeKnowledge = buildSnakeKnowledgePrompt();
const snakeContext = await getBorreContext();
const developmentContext = getBorreDevelopmentContext();
const system = getArneSystemPrompt();

const response = await openai.responses.create({
  model: "gpt-5-mini",
  input: [
    {
      role: "system",
      content: system,
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
}