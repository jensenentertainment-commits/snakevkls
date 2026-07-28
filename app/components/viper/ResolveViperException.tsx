"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResolveViperException({ exceptionId }: { exceptionId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    if (!note.trim() || busy) return;
    setBusy(true); setError(null);
    const response = await fetch(`/api/viper/admin/exceptions/${exceptionId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolutionNote: note }),
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Kunne ikke løse avviket");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4">
      <label className="text-sm font-bold" htmlFor={`resolution-${exceptionId}`}>
        Forklaring
      </label>
      <textarea id={`resolution-${exceptionId}`} value={note}
        onChange={(event) => setNote(event.target.value)} rows={2}
        className="mt-1 w-full rounded-xl border border-neutral-300 p-3" />
      <button type="button" disabled={!note.trim() || busy} onClick={resolve}
        className="mt-2 min-h-12 w-full rounded-xl bg-[#055a7d] px-4 font-bold text-white disabled:opacity-50">
        {busy ? "Lagrer …" : "Marker som løst"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{error}</p>}
    </div>
  );
}
