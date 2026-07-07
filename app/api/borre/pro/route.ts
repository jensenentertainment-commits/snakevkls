import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getBorreContext } from "@/lib/intelligence/borre/shared-context";
import { getBorreDevelopmentContext } from "@/lib/intelligence/borre/development-context";
import { getBorreProSystemPrompt } from "@/lib/intelligence/borre/pro-system";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Kun administrator har tilgang til Børre Pro." },
      { status: 403 }
    );
  }

  const { question, page, history = [] } = await req.json();

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
          (m) =>
            (m.role === "user" || m.role === "assistant") &&
            typeof m.text === "string"
        )
        .map((m) => ({
          role: m.role,
          content: m.text,
        }))
    : [];

  const snakeContext = await getBorreContext();
  const developmentContext = getBorreDevelopmentContext();
  const system = getBorreProSystemPrompt();

  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
      { role: "system", content: system },
      {
        role: "user",
        content: `
Nåværende side:
${page ?? "ukjent"}

Snake-driftskontekst:
${JSON.stringify(snakeContext, null, 2)}

Snake-utviklingskontekst:
${JSON.stringify(developmentContext, null, 2)}
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
      "Børre Pro fikk ikke svart. Det er irriterende, men teknisk mulig.",
  });
}