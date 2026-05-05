"use client";

import { createClient } from "@/lib/supabase/client";

export default function SnakeLogoutButton() {
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/25 hover:text-white"
    >
      Logg ut
    </button>
  );
}