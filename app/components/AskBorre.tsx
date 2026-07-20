"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";

type AskBorreMode = "floating" | "page";
type AssistantVariant = "borre" | "arne";

type Props = {
  mode?: AskBorreMode;
  variant?: AssistantVariant;
};

type Message = {
  role: "user" | "assistant";
  text: string;
};

const borreSuggestions = [
  "Hva bør jeg gjøre først?",
  "Hvorfor er Snake Health lav?",
  "Status på Shopify-sync?",
  "Hvor mange produkter mangler lokasjon?",
  "Gi meg en kort lagerstatus.",
];

const arneSuggestions = [
  "Hva bør vi prioritere nå?",
  "Ser du varige svakheter i Snake?",
  "Passer dagens roadmap fortsatt?",
  "Hva bør vi ikke bygge ennå?",
  "Har vi diskutert dette før?",
];

const enabledRoutes = [
  "/lager",
  "/products",
  "/locations",
  "/issues",
  "/location-count",
  "/activities",
  "/snakeboard",
  "/viper",
];

export default function AskBorre({
  mode = "floating",
 variant = "borre",
}: Props) {
  const pathname = usePathname();
  const isPage = mode === "page";
const isArne = variant === "arne";

const suggestions = isArne ? arneSuggestions : borreSuggestions;
const endpoint = isArne ? "/api/arne/ask" : "/api/borre/ask";

  const [open, setOpen] = useState(isPage);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  if (
    mode === "floating" &&
    !enabledRoutes.some((route) => pathname.startsWith(route))
  ) {
    return null;
  }

  async function ask(customQuestion?: string) {
    const finalQuestion = customQuestion ?? question;
    if (!finalQuestion.trim() || busy) return;

    setBusy(true);
    setQuestion("");

    setMessages((prev) => [...prev, { role: "user", text: finalQuestion }]);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: finalQuestion,
          page: pathname,
          history: messages.slice(-8),
        }),
      });

      const json = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
  json.answer ??
  (isArne
    ? "Arne fikk ikke svart. Det var dårlig timing."
    : "Børre fikk ikke svart. Det er uvanlig, men ikke umulig."),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: isArne
  ? "Arne mistet kontakten. Det var neppe planlagt."
  : "Børre mistet kontakten. Det var neppe med vilje.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const panel = (
    <section
      className={[
        "flex flex-col overflow-hidden border border-white/10 bg-[#062f3b] text-white shadow-2xl shadow-black/40",
        isPage
          ? "h-[720px] rounded-[28px]"
          : "h-[calc(100vh-135px)] w-[380px] max-w-[calc(100vw-2rem)] rounded-[28px]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b58a14]">
            {isArne ? "Arne" : "Børre"}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {isArne ? "Utviklingsrommet for Snake." : "Er du i tvil, spør Børre."}
          </p>
        </div>

        {!isPage && (
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-white/60 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((item) => (
            <button
              key={item}
              onClick={() => ask(item)}
              disabled={busy}
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-white/55">
            {isArne
              ? "Arne er klar. Spør om Snake, arbeidsflyt, moduler, kode eller hva som bør bygges videre."
              : "Børre er på plass. Spør om lagerstatus, Shopify-sync, avvik eller hva som bør ryddes først."}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={[
                  "rounded-2xl px-4 py-3 text-sm leading-6",
                  message.role === "user"
                    ? "ml-8 bg-[#055a7d] text-white"
                    : "mr-8 border border-white/10 bg-black/20 text-white/75",
                ].join(" ")}
              >
                {message.text}
              </div>
            ))}

            {busy && (
              <div className="mr-8 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
                <div className="flex items-center gap-2">
                  <span>{isArne ? "Arne tenker" : "Børre tenker"}</span>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b58a14]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b58a14] [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b58a14] [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-[#062f3b] p-5">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={isArne ? "Hva skal vi utvikle?" : "Hva lurer du på?"}
          className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#b58a14]/40"
        />

        <button
          onClick={() => ask()}
          disabled={busy}
          className="mt-3 w-full rounded-2xl bg-[#b58a14] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#a77e05] disabled:opacity-50"
        >
          {busy
            ? isArne
              ? "Arne tenker..."
              : "Børre tenker..."
            : isArne
              ? "Spør Arne"
              : "Spør Børre"}
        </button>
      </div>
    </section>
  );

  if (isPage) return panel;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#062f3b] px-5 py-4 text-sm font-black text-white shadow-2xl shadow-black/35 transition hover:-translate-y-0.5 hover:bg-[#05495b]"
        >
          <MessageCircle className="h-5 w-5 text-[#b58a14]" />
          Børre
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 top-[110px] z-50">
          {panel}
        </div>
      )}
    </>
  );
}