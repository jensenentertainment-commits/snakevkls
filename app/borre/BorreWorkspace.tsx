"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/design-system/Button";
import { CHAT_LIMITS, type ChatMessage } from "@/lib/intelligence/shared/chat-input";

const prompts = ["Hva er registrert på lageret?", "Finnes det positiv beholdning uten gyldig lokasjon?", "Hva betyr PICK og BUFFER?"];

export function BorreWorkspace({ compact = false, page = "/borre" }: { compact?: boolean; page?: string }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy, error]);

  async function send() {
    const text = question.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/borre/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, page, history: messages.slice(-CHAT_LIMITS.historyMessages) }),
      });
      const data = await response.json() as { answer?: unknown };
      if (!response.ok || typeof data.answer !== "string" || !data.answer.trim()) throw new Error("BORRE_CHAT_FAILED");
      const answer = data.answer;
      setMessages(previous => [...previous, { role: "user", text }, { role: "assistant", text: answer }]);
      setQuestion("");
    } catch {
      setError("Jeg fikk ikke hentet svaret. Spørsmålet er beholdt, så du kan prøve igjen. Ingen lagerdata er endret.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <section aria-labelledby="borre-chat-title" className={`flex min-w-0 flex-col overflow-hidden bg-snake-app-elevated text-snake-text-on-dark ${compact ? "h-full min-h-0 p-3" : "h-[min(700px,85dvh)] min-h-[520px] p-5 sm:p-6 lg:h-[min(840px,90dvh)]"}`}>
    <h2 id="borre-chat-title" className={compact ? "sr-only" : "text-xl font-semibold text-snake-brand"}>Snakk med Børre</h2>
    {!compact && <p className="mt-2 text-sm text-snake-text-on-dark-muted">Finn frem til varer, lokasjoner og registrert beholdning.</p>}
    <div ref={logRef} role="log" tabIndex={0} aria-label="Samtale med Børre" aria-live="polite" aria-busy={busy} className="my-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-snake-card border border-snake-border-on-dark-default bg-snake-app-deep p-3 focus-visible:outline-2 focus-visible:outline-snake-focus-on-dark">
      {messages.length === 0 && !busy ? <>
        <Bubble role="assistant" text="Hei! Hva trenger du hjelp med? Jeg kan sjekke varer, lokasjoner og beholdning i Snake." />
        <div className="flex flex-wrap gap-2" aria-label="Hurtigspørsmål">{prompts.map(prompt => <button key={prompt} type="button" onClick={() => { setQuestion(prompt); inputRef.current?.focus(); }} className="min-h-9 rounded-snake-control border border-snake-border-on-dark-strong px-3 py-2 text-left text-xs text-snake-text-on-dark-muted hover:border-snake-brand focus-visible:outline-2 focus-visible:outline-snake-focus">{prompt}</button>)}</div>
      </> : null}
      {messages.map((message, index) => <Bubble key={index} {...message} />)}
      {busy ? <><Bubble role="user" text={question} /><div role="status" className="mr-4 rounded-snake-card border border-snake-border-on-dark-subtle bg-[#345C45] p-3 sm:mr-12 sm:p-4"><p className="mb-2 text-sm font-semibold">Børre</p><div className="flex items-center gap-3"><span aria-hidden="true" className="flex shrink-0 gap-1">{[0, 1, 2].map(i => <span key={i} style={{ animationDelay: `${i * 250}ms`, animationDuration: "1800ms" }} className="h-2 w-2 rounded-sm bg-current motion-safe:animate-pulse motion-reduce:animate-none" />)}</span><p className="text-sm leading-6">Ser nærmere på spørsmålet ditt …</p></div></div></> : null}
      {error ? <div role="alert"><Bubble role="assistant" text={error} /></div> : null}
    </div>
    <form onSubmit={event => { event.preventDefault(); void send(); }} className="flex shrink-0 items-end gap-2 rounded-snake-action border border-snake-border-on-dark-strong bg-snake-app-deep p-2 focus-within:border-snake-focus">
      <label className="sr-only" htmlFor="borre-question">Skriv til Børre</label>
      <textarea ref={inputRef} id="borre-question" rows={2} maxLength={CHAT_LIMITS.questionCharacters} value={question} disabled={busy} onChange={event => setQuestion(event.target.value)} placeholder="Spør om en vare, Variant-ID eller lokasjon…" className="max-h-40 min-h-16 min-w-0 flex-1 resize-y bg-transparent p-2 text-sm text-snake-text-on-dark placeholder:text-snake-text-on-dark-muted outline-none" />
      <Button type="submit" variant="brand" loading={busy} loadingLabel="Børre undersøker…" disabled={busy || !question.trim()}>Send</Button>
    </form>
    {!compact && <p className="mt-4 text-sm text-snake-text-on-dark-muted">Jeg leser lagerdata. Jeg flytter ikke varer og endrer ikke beholdning.</p>}
  </section>;
}

function Bubble({ role, text }: ChatMessage) {
  return <div className={`rounded-snake-card border border-snake-border-on-dark-subtle p-3 sm:p-4 ${role === "user" ? "ml-4 bg-[#DCE5EA] text-snake-text-primary sm:ml-12" : "mr-4 bg-[#345C45] text-snake-text-on-dark sm:mr-12"}`}>
    <p className="mb-2 text-sm font-semibold">{role === "user" ? "Du" : "Børre"}</p>
    <p className="whitespace-pre-wrap break-words text-sm leading-6">{text}</p>
  </div>;
}
