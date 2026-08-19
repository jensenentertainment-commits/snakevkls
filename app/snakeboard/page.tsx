"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  AlertTriangle,
  Info,
  Megaphone,
  Send,
  Trash2,
} from "lucide-react";

import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";

type MessageType = "info" | "important" | "issue";

type SnakeboardMessage = {
  id: string;
  title: string;
  body: string | null;
  type: MessageType;
  status: "active" | "archived";
  created_by_name: string | null;
  created_by_role?: "admin" | "user" | "warehouse" | null;
  created_at: string;
};

const TYPE_OPTIONS: {
  value: MessageType;
  label: string;
  description: string;
}[] = [
  { value: "info", label: "Info", description: "Vanlig lagerbeskjed" },
  { value: "important", label: "Viktig", description: "Noe alle bør få med seg" },
  { value: "issue", label: "Avvik", description: "Noe som må sjekkes eller følges opp" },
];

export default function SnakeBoardPage() {
  const [messages, setMessages] = useState<SnakeboardMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | MessageType>("all");
const [isAdmin, setIsAdmin] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<MessageType>("info");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SnakeboardMessage | null>(null);
const [deleting, setDeleting] = useState(false);

  async function loadMessages() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/snakeboard", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Kunne ikke hente SnakeBoard");
      }

      setMessages(json.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

 useEffect(() => {
  async function loadMe() {
    try {
      const res = await fetch("/api/account/me", { cache: "no-store" });
      const json = await res.json();

      if (res.ok) {
        setIsAdmin(json.profile?.role === "admin");
      }
    } catch {
      setIsAdmin(false);
    }
  }

  loadMe();
  loadMessages();
}, []);
  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle) {
      setError("Mangler tittel");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/snakeboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          body: cleanBody || null,
          type,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Kunne ikke lagre beskjed");
      }

      setTitle("");
      setBody("");
      setType("info");

      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setSaving(false);
    }
  }

 async function deleteMessage(message: SnakeboardMessage) {
  setDeleting(true);
  setError(null);

  try {
    const res = await fetch("/api/snakeboard/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: message.id }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error ?? "Kunne ikke slette melding");
    }

    setMessages((prev) => prev.filter((item) => item.id !== message.id));
    setDeleteTarget(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Ukjent feil");
  } finally {
    setDeleting(false);
  }
}

  const filteredMessages = useMemo(() => {
    if (filter === "all") return messages;
    return messages.filter((message) => message.type === filter);
  }, [messages, filter]);

  const importantCount = messages.filter((m) => m.type === "important").length;
  const issueCount = messages.filter((m) => m.type === "issue").length;

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <section className="overflow-hidden rounded-[28px] bg-[#e8eef0] text-neutral-950 shadow-2xl shadow-black/30">
          <div className="relative overflow-hidden bg-[#05495b] text-white">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

            <div className="relative px-8 py-10 sm:px-10 xl:px-12">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Tilbake til dashboard
              </Link>

              <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                    Operativ tavle
                  </p>

                  <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                    SnakeBoard
                  </h1>

                  <p className="mt-4 max-w-xl text-sm leading-6 text-white/65">
                    Korte beskjeder fra lageret. Ikke chat. Ikke støy. Bare ting
                    folk bør vite før de begynner å flytte varer.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                  <StatCard label="aktive" value={messages.length} />
                  <StatCard label="viktige" value={importantCount} tone="important" />
                  <StatCard label="avvik" value={issueCount} tone="issue" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 px-5 py-7 sm:px-8 sm:py-8 lg:grid-cols-[420px_1fr]">
            <form
              onSubmit={submitMessage}
              className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#055a7d]/15 bg-[#055a7d]/10 text-[#055a7d]">
                  <Megaphone className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-neutral-950">
                    Ny beskjed
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Legg noe på tavla.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Type
                  </label>

                  <div className="mt-2 grid gap-2">
                    {TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setType(option.value)}
                        className={[
                          "rounded-2xl border px-4 py-3 text-left transition",
                          type === option.value
                            ? "border-[#055a7d] bg-[#055a7d]/10"
                            : "border-black/10 bg-neutral-50 hover:border-[#055a7d]/40",
                        ].join(" ")}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                          <TypeIcon type={option.value} />
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs text-neutral-500">
                          {option.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Tittel
                  </label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                    placeholder="Kort og tydelig..."
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#055a7d]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Beskjed
                  </label>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={1000}
                    rows={5}
                    placeholder="Valgfritt, men nyttig hvis noen trenger kontekst."
                    className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#055a7d]"
                  />
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#044b68] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {saving ? "Lagrer..." : "Legg på SnakeBoard"}
                </button>
              </div>
            </form>

            <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#055a7d]/70">
                    Tavle
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
                    Aktive beskjeder
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                    Alle
                  </FilterButton>
                  <FilterButton active={filter === "important"} onClick={() => setFilter("important")}>
                    Viktig
                  </FilterButton>
                  <FilterButton active={filter === "issue"} onClick={() => setFilter("issue")}>
                    Avvik
                  </FilterButton>
                  <FilterButton active={filter === "info"} onClick={() => setFilter("info")}>
                    Info
                  </FilterButton>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <EmptyState text="Henter SnakeBoard..." />
                ) : filteredMessages.length === 0 ? (
                  <EmptyState text="Ingen beskjeder her akkurat nå." />
                ) : (
                  filteredMessages.map((message) => (
                  <MessageCard
  key={message.id}
  message={message}
  canDelete={isAdmin}
  onDelete={setDeleteTarget}
/>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
{deleteTarget && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
    <div className="w-full max-w-md rounded-[28px] bg-white p-6 text-neutral-950 shadow-2xl">
      <h2 className="text-2xl font-semibold tracking-tight">
        Slett melding?
      </h2>

      <p className="mt-2 text-sm leading-6 text-neutral-500">
        Dette sletter meldingen fra SnakeBoard. Handlingen kan ikke angres.
      </p>

      <div className="mt-5 rounded-2xl border border-black/10 bg-neutral-50 p-4">
        <p className="font-semibold text-neutral-950">{deleteTarget.title}</p>
        {deleteTarget.body && (
          <p className="mt-1 text-sm text-neutral-600">{deleteTarget.body}</p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDeleteTarget(null)}
          disabled={deleting}
          className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold"
        >
          Avbryt
        </button>

        <button
          type="button"
          onClick={() => deleteMessage(deleteTarget)}
          disabled={deleting}
          className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {deleting ? "Sletter..." : "Slett"}
        </button>
      </div>
    </div>
  </div>
)}
        <SnakeFooter />
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "important" | "issue";
}) {
  const toneClass =
    tone === "issue"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "important"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-white/10 bg-white/[0.06] text-white";

  return (
    <div className={`rounded-3xl border p-4 ${toneClass}`}>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
        {label}
      </p>
    </div>
  );
}

function MessageCard({
  message,
  canDelete,
  onDelete,
}: {
  message: SnakeboardMessage;
  canDelete: boolean;
  onDelete: (message: SnakeboardMessage) => void;
}) {
  
  const tone =
    message.type === "issue"
      ? "border-red-200 bg-red-50"
      : message.type === "important"
        ? "border-amber-200 bg-amber-50"
        : "border-black/10 bg-neutral-50";
        

  return (
    <article className={`rounded-3xl border p-5 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-neutral-800">
          <TypeIcon type={message.type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-neutral-950">{message.title}</h3>

            <div className="flex items-center gap-2">
  <p className="text-xs text-neutral-500">
    {new Date(message.created_at).toLocaleString("nb-NO")}
  </p>

  {canDelete && (
    <button
      type="button"
      onClick={() => onDelete(message)}
      className="rounded-full p-1.5 text-neutral-400 transition hover:bg-red-100 hover:text-red-700"
      title="Slett melding"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )}
</div>
          </div>

          {message.body && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
              {message.body}
            </p>
          )}

          <p className="mt-3 text-xs font-medium text-neutral-500">
            {message.created_by_name ?? "Ukjent bruker"}
          </p>
        </div>
      </div>
    </article>
  );
}

function TypeIcon({ type }: { type: MessageType }) {
  if (type === "issue") return <AlertTriangle className="h-4 w-4" />;
  if (type === "important") return <Megaphone className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition",
        active
          ? "border-[#055a7d] bg-[#055a7d] text-white"
          : "border-black/10 bg-neutral-50 text-neutral-600 hover:border-[#055a7d]/40",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-black/15 bg-neutral-50 p-8 text-center">
      <ClipboardList className="mx-auto h-8 w-8 text-neutral-400" />
      <p className="mt-3 text-sm text-neutral-500">{text}</p>
    </div>
  );
}
