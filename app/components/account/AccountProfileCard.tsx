"use client";

import { useState } from "react";
import { Loader2, UserRound } from "lucide-react";

type Props = {
  displayName: string;
  email: string;
  role: string;
};

export default function AccountProfileCard({
  displayName,
  email,
  role,
}: Props) {
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setMessage(null);
    setError(null);

    if (!name.trim()) {
      setError("Visningsnavn kan ikke være tomt.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Kunne ikke lagre profil");
      }

      setMessage("Profilen er oppdatert.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#055a7d]/15 bg-[#055a7d]/10 text-[#055a7d]">
          <UserRound className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Profil
          </h2>
          <p className="text-sm text-neutral-500">
            Kontoinformasjon for innlogget bruker.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            E-post
          </label>
          <input
            value={email}
            disabled
            className="mt-2 w-full rounded-2xl border border-black/10 bg-neutral-100 px-4 py-3 text-sm text-neutral-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Rolle
          </label>
          <input
            value={role}
            disabled
            className="mt-2 w-full rounded-2xl border border-black/10 bg-neutral-100 px-4 py-3 text-sm text-neutral-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Visningsnavn
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-[#055a7d]"
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#044b68] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Lagrer..." : "Lagre profil"}
        </button>
      </div>
    </section>
  );
}