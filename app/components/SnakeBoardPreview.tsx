"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MessageType = "info" | "important" | "issue";

type SnakeboardMessage = {
  id: string;
  title: string;
  type: MessageType;
  created_at: string;
  created_by_name: string | null;
};

export default function SnakeBoardPreview() {
  const [messages, setMessages] = useState<SnakeboardMessage[]>([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
  async function loadMessages() {
    try {
      const res = await fetch("/api/snakeboard?limit=3", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Kunne ikke hente SnakeBoard");
      }

      setMessages(json.messages ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  loadMessages();
}, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            SnakeBoard
          </p>

          <h2 className="mt-2 text-lg font-semibold text-white">
            Siste beskjeder
          </h2>
        </div>

        <Link
          href="/snakeboard"
          className="text-sm font-medium text-white/55 transition hover:text-white"
        >
          Se alle
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
  <div className="space-y-3">
    <SnakeBoardPreviewSkeleton />
    <SnakeBoardPreviewSkeleton />
    <SnakeBoardPreviewSkeleton />
  </div>
) : messages.length === 0 ? (
          <p className="text-sm text-white/40">
            Ingen beskjeder enda.
          </p>
        ) : (
          messages.map((message) => (
            <SnakeBoardPreviewItem
              key={message.id}
              type={message.type}
              title={message.title}
                createdBy={message.created_by_name}
                createdAt={message.created_at}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SnakeBoardPreviewSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/10" />

      <div className="h-8 w-8 shrink-0 rounded-full border border-white/10 bg-white/5" />

      <div className="min-w-0 flex-1">
        <div className="h-3 w-3/4 rounded-full bg-white/10" />
        <div className="mt-2 h-2.5 w-20 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

function getInitials(name: string | null) {
  if (!name) return "?";

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "nå";
  if (minutes < 60) return `${minutes} min siden`;
  if (hours < 24) return `${hours} t siden`;
  if (days < 7) return `${days} d siden`;

  return date.toLocaleDateString("nb-NO");
}

function SnakeBoardPreviewItem({
  type,
  title,
  createdBy,
  createdAt,
}: {
  type: MessageType;
  title: string;
  createdBy: string | null;
  createdAt: string;
}) {
  const tone =
    type === "issue"
      ? "bg-red-300"
      : type === "important"
        ? "bg-amber-300"
        : "bg-cyan-300";

  return (
    <Link
      href="/snakeboard"
      className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-black/10 px-4 py-3 transition hover:border-white/20 hover:bg-black/20"
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-white/70">
        {getInitials(createdBy)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white/85 group-hover:text-white">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-white/35">
          {formatRelativeTime(createdAt)}
        </p>
      </div>
    </Link>
  );
}