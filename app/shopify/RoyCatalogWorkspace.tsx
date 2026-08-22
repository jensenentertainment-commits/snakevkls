"use client";

import { useRef, useState } from "react";
import { Search, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/app/components/design-system/Button";
import { Card } from "@/app/components/design-system/Card";
import { Surface } from "@/app/components/design-system/Surface";
import {
  CHAT_LIMITS,
  type ChatMessage,
} from "@/lib/intelligence/shared/chat-input";

const prompts = [
  "Finn katalogproblemer blant produkter fra Helly Hansen",
  "Vurder titler, varianter og kategorisering i dette utvalget",
  "Hvilke produkter mangler leverandør, produkttype eller kolleksjon?",
];

const HISTORY_STORAGE_KEY = "snake.roy.catalog-history.v1";

function readWorkspaceHistory() {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((message): message is ChatMessage => (
      typeof message === "object" &&
      message !== null &&
      (message as ChatMessage).role !== undefined &&
      ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "assistant") &&
      typeof (message as ChatMessage).text === "string" &&
      (message as ChatMessage).text.length > 0 &&
      (message as ChatMessage).text.length <= CHAT_LIMITS.historyMessageCharacters
    )).slice(-CHAT_LIMITS.historyMessages);
  } catch {
    return [];
  }
}

function writeWorkspaceHistory(history: ChatMessage[]) {
  try {
    window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // The in-memory ref remains authoritative when session storage is unavailable.
  }
}

export function RoyCatalogWorkspace() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const historyRef = useRef<ChatMessage[]>(readWorkspaceHistory());
  const [busy, setBusy] = useState(false);

  async function analyze(value = question) {
    if (!value.trim() || busy) return;
    setQuestion(value);
    setBusy(true);
    setAnswer(null);
    const persistedHistory = readWorkspaceHistory();
    const requestHistory = persistedHistory.length ? persistedHistory : historyRef.current;
    historyRef.current = requestHistory.concat(
      { role: "user", text: value } satisfies ChatMessage,
    ).slice(-CHAT_LIMITS.historyMessages);
    writeWorkspaceHistory(historyRef.current);
    try {
      const response = await fetch("/api/roy/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: value,
          page: "/shopify",
          history: requestHistory,
        }),
      });
      const data = await response.json() as { answer?: unknown };
      const nextAnswer = typeof data.answer === "string"
        ? data.answer
        : "Roy kunne ikke analysere dette utvalget.";
      setAnswer(nextAnswer);
      historyRef.current = historyRef.current.concat(
        { role: "assistant", text: nextAnswer } satisfies ChatMessage,
      ).slice(-CHAT_LIMITS.historyMessages);
      writeWorkspaceHistory(historyRef.current);
    } catch {
      setAnswer("Roy mistet kontakten. Ingen katalogdata er endret.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Surface className="p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="rounded-snake-control bg-snake-brand-soft p-3 text-snake-brand-strong"><Sparkles aria-hidden size={22} /></div>
          <div>
            <p className="text-sm font-semibold text-snake-text-primary">Spør Roy om katalogen</p>
            <p className="mt-1 text-sm text-snake-text-secondary">Søk målrettet i sist synkroniserte Shopify-data. Roy observerer og anbefaler, men endrer ingenting.</p>
          </div>
        </div>
        <label className="mt-6 block text-sm font-semibold text-snake-text-primary" htmlFor="roy-question">Produkt, SKU, leverandør eller problemstilling</label>
        <textarea
          id="roy-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="mt-2 min-h-32 w-full rounded-snake-action border border-snake-border-default bg-snake-surface p-4 text-snake-text-primary outline-none focus:border-snake-focus focus:ring-2 focus:ring-snake-focus-soft"
          placeholder="Eksempel: Finn produkter fra Helly Hansen med svak kategorisering"
        />
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void analyze()} disabled={busy || !question.trim()}>
            <Search aria-hidden size={18} /> {busy ? "Roy undersøker…" : "Analyser katalogutvalg"}
          </Button>
        </div>
        {answer ? (
          <div aria-live="polite" className="mt-6 whitespace-pre-wrap rounded-snake-card border border-snake-border-subtle bg-snake-surface-subtle p-5 text-sm leading-6 text-snake-text-primary">{answer}</div>
        ) : null}
      </Surface>

      <div className="space-y-4">
        <Card className="p-5">
          <p className="flex items-center gap-2 font-semibold text-snake-text-primary"><ShieldCheck aria-hidden size={18} /> Read-only i v1</p>
          <p className="mt-2 text-sm leading-6 text-snake-text-secondary">Ingen publisering, redigering, sync eller Shopify-skriving. Beskrivelse, SEO-felt og full bildegalleri finnes ikke i Snake-katalogen og markeres som kunnskapshull.</p>
        </Card>
        <Card className="p-5">
          <p className="font-semibold text-snake-text-primary">Forslag</p>
          <div className="mt-3 space-y-2">
            {prompts.map((prompt) => (
              <button key={prompt} onClick={() => void analyze(prompt)} disabled={busy} className="w-full rounded-snake-control border border-snake-border-default bg-snake-surface px-3 py-3 text-left text-sm text-snake-text-secondary hover:border-snake-primary hover:text-snake-text-primary disabled:opacity-50">{prompt}</button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
