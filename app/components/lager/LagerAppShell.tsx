"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AppNavbar, AppShell, ModuleNav } from "@/app/components/layout";
import { LAGER_MODULE_NAVIGATION } from "@/app/components/navigation";
import { isRole, type Role } from "@/lib/auth/roles";
import { supabase } from "@/lib/supabase";

import { LagerLogoutButton } from "./LagerLogoutButton";

type LagerProfile = {
  active: boolean;
  display_name: string | null;
  role: Role;
};

export type LagerAppShellProps = {
  children: ReactNode;
};

const fallbackProfile: LagerProfile = {
  active: true,
  display_name: "Bruker",
  role: "lager",
};

export function LagerAppShell({ children }: LagerAppShellProps) {
  const [profile, setProfile] = useState<LagerProfile>(fallbackProfile);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("role, display_name, active")
        .eq("id", user.id)
        .single();

      if (
        active &&
        data?.active === true &&
        isRole(data.role)
      ) {
        setProfile(data as LagerProfile);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell
      moduleNav={<ModuleNav navigation={LAGER_MODULE_NAVIGATION} />}
      navbar={
        <AppNavbar
          isAdmin={profile.role === "admin"}
          logoutSlot={<LagerLogoutButton />}
          user={{
            displayName: profile.display_name ?? "Bruker",
            roleLabel: profile.role === "admin" ? "Administrator" : "Lager",
          }}
        />
      }
      width="wide"
    >
      {children}
    </AppShell>
  );
}
