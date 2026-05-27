import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(["admin", "lager", "viewer"]);

  if (!auth.ok) return auth.response;

  return NextResponse.json({
    user: {
      id: auth.user.id,
      email: auth.user.email ?? null,
    },
    profile: auth.profile,
  });
}