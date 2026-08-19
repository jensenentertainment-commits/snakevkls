import "server-only";

import OpenAI from "openai";
import { NextResponse } from "next/server";

export const CHAT_MODEL = "gpt-5-mini";

let openAIClient: OpenAI | null = null;

export function getChatOpenAIClient() {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openAIClient;
}

export function chatInputError(message: string) {
  return NextResponse.json(
    {
      error: message,
      answer: message,
    },
    { status: 400 }
  );
}

export function chatServerError() {
  const message = "Tjenesten er midlertidig utilgjengelig. Prøv igjen senere.";

  return NextResponse.json(
    {
      error: message,
      answer: message,
    },
    { status: 500 }
  );
}

export function logChatServerError(
  assistant: "borre" | "arne" | "roy",
  stage: "request" | "context" | "openai" | "unexpected",
  error: unknown
) {
  console.error(`[${assistant}] ${stage} failed`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
  });
}
