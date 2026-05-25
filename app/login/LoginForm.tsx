"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginForm() {
 

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
  email: email.trim(),
  password,
});

    if (error) {
      setError("Innlogging avvist.");
      setBusy(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#062f3b] px-4 text-white overflow-hidden">
     <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
  <img
    src="/snake2.png"
    alt=""
    className="w-[780px] max-w-none rotate-[6deg] opacity-[0.055] blur-[1px]"
  />
</div>
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-[32px] border border-white/10 bg-white/[0.045] p-7 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      >
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">
          Snake VKLS
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Systemtilgang
        </h1>
<div className="mt-4 h-px w-16 bg-gradient-to-r from-[#b58a14] to-transparent" />
        <p className="mt-2 text-sm leading-6 text-white/60">
          Innlogging kreves før lagerdata kan vises.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-white/45">
              E-post
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white outline-none transition placeholder:text-white/25 focus:border-[#b58a14]/40 focus:bg-black/25"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-white/45">
              Passord
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-white/30"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
         className="mt-6 w-full rounded-2xl bg-[#b58a14] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#b58a14]/10 transition hover:bg-[#a77e05] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Kontrollerer tilgang..." : "Logg inn"}
        </button>
      </form>
    </main>
  );
}