import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccessDecision, type Role } from "@/lib/auth/roles";

export async function requireRole(allowedRoles: readonly Role[]) {
  const authClient = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  const authenticated = !userError && Boolean(user);

  if (
    getAccessDecision({ authenticated, profile: null, allowedRoles }) ===
      "unauthenticated" ||
    !user
  ) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Ikke innlogget" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role, active, display_name")
    .eq("id", user.id)
    .single();

  const accessDecision = getAccessDecision({
    authenticated: true,
    profile: profileError ? null : profile,
    allowedRoles,
  });

  if (accessDecision !== "allowed") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Mangler tilgang" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    authClient,
    user,
    profile: profile as {
      role: Role;
      active: boolean;
      display_name: string | null;
    },
  };
}
