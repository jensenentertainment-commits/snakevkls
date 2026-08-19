"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AppNavbar, AppShell, ModuleNav } from "@/app/components/layout";
import type { ModuleNavigation } from "@/app/components/navigation";
import { isRole, type Role } from "@/lib/auth/roles";
import { supabase } from "@/lib/supabase";

import { AppLogoutButton } from "./AppLogoutButton";

type AppProfile = {
  active: boolean;
  display_name: string | null;
  role: Role;
};

export type AuthenticatedAppShellProps = {
  children: ReactNode;
  moduleNavigation?: ModuleNavigation;
  width?: "default" | "wide";
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  user: "Bruker",
  warehouse: "Lager",
  lager: "Lager (legacy)",
};

export function AuthenticatedAppShell({
  children,
  moduleNavigation,
  width = "default",
}: AuthenticatedAppShellProps) {
  const [profile, setProfile] = useState<AppProfile | null>(null);

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

      if (active && data?.active === true && isRole(data.role)) {
        setProfile(data as AppProfile);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell
      moduleNav={
        moduleNavigation ? (
          <ModuleNav navigation={moduleNavigation} />
        ) : undefined
      }
      navbar={
        <AppNavbar
          isAdmin={profile?.role === "admin"}
          logoutSlot={<AppLogoutButton />}
          role={profile?.role}
          user={{
            displayName: profile?.display_name ?? "Bruker",
            roleLabel: profile ? ROLE_LABELS[profile.role] : undefined,
          }}
        />
      }
      width={width}
    >
      {children}
    </AppShell>
  );
}
