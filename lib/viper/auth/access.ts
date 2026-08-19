import "server-only";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";

export type ViperActor = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: "admin" | "user" | "warehouse";
};

export async function requireViperApiActor() {
  const auth = await requireRole(["admin", "user", "warehouse"]);

  if (!auth.ok) return auth;

  return {
    ok: true as const,
    actor: {
      id: auth.user.id,
      email: auth.user.email ?? null,
      displayName: auth.profile.display_name,
      role: auth.profile.role as ViperActor["role"],
    },
  };
}

export async function requireViperPageActor(): Promise<ViperActor> {
  const auth = await requireViperApiActor();

  if (!auth.ok) {
    redirect(auth.response.status === 401 ? "/login" : "/dashboard");
  }

  return auth.actor;
}

export async function requireViperAdminApiActor() {
  const auth = await requireRole(["admin"]);
  if (!auth.ok) return auth;
  return {
    ok: true as const,
    actor: {
      id: auth.user.id,
      email: auth.user.email ?? null,
      displayName: auth.profile.display_name,
      role: "admin" as const,
    },
  };
}

export async function requireViperAdminPageActor(): Promise<ViperActor> {
  const auth = await requireViperAdminApiActor();
  if (!auth.ok) redirect(auth.response.status === 401 ? "/login" : "/viper");
  return auth.actor;
}
