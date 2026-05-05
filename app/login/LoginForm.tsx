"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Innlogging avvist.");
      setBusy(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#062f3b] px-4 text-white overflow-hidden">
     <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
  <img
    src="/snake2.png"
    alt=""
    className="w-[820px] max-w-none opacity-[0.045] blur-[1.5px] rotate-[6deg]"
  />
</div>
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur"
      >
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">
          Snake VKLS
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Systemtilgang
        </h1>

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
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-white/30"
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
          className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#062f3b] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Kontrollerer tilgang" : "Logg inn"}
        </button>
      </form>
    </main>
  );
}