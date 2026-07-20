import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { isRole, type Role } from "@/lib/auth/roles";

export async function requireRole(allowedRoles: readonly Role[]) {
  const authClient = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
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

  if (
    profileError ||
    !profile?.active ||
    !isRole(profile.role) ||
    !allowedRoles.includes(profile.role)
  ) {
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
