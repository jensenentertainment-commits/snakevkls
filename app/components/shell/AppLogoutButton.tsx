"use client";

import { Button } from "@/app/components/design-system";
import { supabase } from "@/lib/supabase";

export function AppLogoutButton() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <Button
      className="w-full"
      onClick={handleLogout}
      size="sm"
      variant="secondary"
    >
      Logg ut
    </Button>
  );
}
