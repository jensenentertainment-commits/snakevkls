import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getSpmStatus } from "@/lib/spm/status";

export async function GET() {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const status = await getSpmStatus();

  return NextResponse.json(
    status ?? {}
  );
}