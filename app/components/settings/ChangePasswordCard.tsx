"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ChangePasswordCard() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setMessage(null);
    setError(null);

    if (password.length < 8) {
      setError("Passordet må være minst 8 tegn.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passordene er ikke like.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setSaving(false);

    if (error) {
      setError("Kunne ikke endre passord.");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessage("Passordet er endret.");
  }

  return (
    <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#055a7d]/15 bg-[#055a7d]/10 text-[#055a7d]">
          <KeyRound className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Endre passord
          </h2>
          <p className="text-sm text-neutral-500">
            Oppdater passordet du bruker for å logge inn i Snake.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Nytt passord"
          className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-[#055a7d]"
        />

        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Bekreft nytt passord"
          className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-[#055a7d]"
        />

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
          {saving ? "Lagrer..." : "Lagre nytt passord"}
        </button>
      </div>
    </section>
  );
}