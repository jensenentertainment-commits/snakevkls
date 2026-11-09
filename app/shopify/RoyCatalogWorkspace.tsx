"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/app/components/design-system/Button";


import {
  CHAT_LIMITS,
  type ChatMessage,
} from "@/lib/intelligence/shared/chat-input";

const prompts = [
  "Hva bør jeg prioritere i katalogen?",
  "Hvilke produkter mangler bilder?",
  "Hvilke produkter mangler beskrivelser?",
  "Hvor mange produkter har vi i katalogen?",
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{ const log=logRef.current; if(log) log.scrollTop=log.scrollHeight; },[messages,answer,busy]);

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
    setMessages([...historyRef.current]);
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
      setMessages([...historyRef.current]);
    } catch {
      setAnswer("Roy mistet kontakten. Ingen katalogdata er endret.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="roy-conversation" aria-labelledby="roy-chat-title" className="flex h-[min(700px,85dvh)] lg:h-[min(840px,90dvh)] min-h-[520px] min-w-0 flex-col overflow-hidden bg-snake-app-elevated p-5 text-snake-text-on-dark sm:p-6">
      <h2 id="roy-chat-title" className="text-xl font-semibold text-snake-brand">Snakk med Roy</h2>
      <p className="mt-2 text-sm text-snake-text-on-dark-muted">Spør om et produkt, eller utforsk katalogen sammen med Roy.</p>
      <div ref={logRef} role="log" tabIndex={0} aria-label="Samtale med Roy" aria-live="polite" aria-busy={busy} className="my-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-snake-card border border-snake-border-on-dark-default bg-snake-app-deep p-3 focus-visible:outline-2 focus-visible:outline-snake-focus-on-dark lg:max-h-none">
        {messages.length===0?<><ConversationBubble role="assistant" text="Hva vil du se nærmere på? Jeg kan hjelpe deg å finne frem i katalogen og forstå funnene i arbeidsrapporten."/>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Hurtigspørsmål">{prompts.map(prompt=><button key={prompt} type="button" onClick={()=>setQuestion(prompt)} disabled={busy} className="min-h-9 rounded-snake-control border border-snake-border-on-dark-strong px-3 py-2 text-left text-xs text-snake-text-on-dark-muted hover:border-snake-brand hover:bg-snake-hero focus-visible:outline-2 focus-visible:outline-snake-focus disabled:opacity-50">{prompt}</button>)}</div>
</>:null}
        {messages.map((message,index)=><ConversationBubble key={index} role={message.role} text={message.text}/>)}
        {answer && messages.at(-1)?.text!==answer?<ConversationBubble role="assistant" text={answer}/>:null}
        {busy?<div role="status" aria-label="Ser nærmere på spørsmålet ditt …" className="mr-4 rounded-snake-card border border-snake-border-on-dark-subtle bg-[#12566B] p-3 sm:mr-12 sm:p-4"><p className="mb-2 text-sm font-semibold">Roy</p><div aria-hidden="true" className="flex items-center gap-3"><span className="flex shrink-0 gap-1">{[0,1,2].map(i=><span key={i} style={{animationDelay:`${i*200}ms`,animationDuration:"1800ms"}} className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse motion-reduce:animate-none"/>)}</span><p className="text-sm leading-6">Ser nærmere på spørsmålet ditt …</p></div></div>:null}
      </div>

      <label className="sr-only block text-sm font-semibold" htmlFor="roy-question">Skriv til Roy</label>
      <div className="flex shrink-0 items-end gap-2 rounded-snake-action border border-snake-border-on-dark-strong bg-snake-app-deep p-2 focus-within:border-snake-focus">
      <textarea rows={2} id="roy-question" value={question} onChange={(event)=>setQuestion(event.target.value)}
        className="max-h-40 min-h-16 min-w-0 flex-1 resize-y bg-transparent p-2 text-sm text-snake-text-on-dark placeholder:text-snake-text-on-dark-muted outline-none"
        placeholder="Spør om katalogen, et produkt, en SKU eller en Variant-ID…" />
      <div className="shrink-0"><Button variant="brand" onClick={()=>void analyze()} disabled={busy || !question.trim()} loading={busy} loadingLabel="Roy undersøker…">Send</Button></div></div>
      <p className="mt-4 text-sm text-snake-text-on-dark-muted">Roy vurderer katalogen og anbefaler tiltak. Han endrer ikke produkter.</p>
    </section>
  );
}

function ConversationBubble({role,text}: ChatMessage) {
  const isUser=role==='user';
  return <div className={`rounded-snake-card border border-snake-border-on-dark-subtle p-3 sm:p-4 ${isUser?'ml-4 bg-[#DCE5EA] text-snake-text-primary sm:ml-12':'mr-4 bg-[#12566B] text-snake-text-on-dark sm:mr-12'}`}>
    <p className="mb-2 text-sm font-semibold">{isUser?'Du':'Roy'}</p>
    <p className="whitespace-pre-wrap break-words text-sm leading-6">{text}</p>
  </div>;
}