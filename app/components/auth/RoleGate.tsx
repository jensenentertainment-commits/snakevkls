"use client";

import { useEffect, useState } from "react";
import SnakeNav from "../SnakeNav";
import SnakeFooter from "../SnakeFooter";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/lib/auth/roles";

type Profile = {
  role: Role;
  active: boolean;
};

export default function RoleGate({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    const profile = data as Profile | null;

    setAllowed(
      Boolean(
        profile?.active &&
          profile.role &&
          allowedRoles.includes(profile.role)
      )
    );

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#062f3b] text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
          <SnakeNav />
          <section className="rounded-[26px] bg-white p-8 text-neutral-950">
            Sjekker tilgang...
          </section>
          <SnakeFooter />
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#062f3b] text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
          <SnakeNav />
          <section className="rounded-[26px] bg-white p-8 text-neutral-950">
            Du har ikke tilgang til denne siden.
          </section>
          <SnakeFooter />
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
