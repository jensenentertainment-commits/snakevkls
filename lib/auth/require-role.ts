import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export type Role = "admin" | "lager" | "viewer";

export async function requireRole(allowedRoles: Role[]) {
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
    !profile.role ||
    !allowedRoles.includes(profile.role as Role)
  ) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Mangler tilgang" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    user,
    profile: profile as {
      role: Role;
      active: boolean;
      display_name: string | null;
    },
  };
}