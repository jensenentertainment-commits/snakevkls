import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";

export async function POST() {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const statusFile = path.join(process.cwd(), "spm-output", "status.json");

  try {
    await fs.unlink(statusFile);
  } catch {
    // statusfil finnes ikke
  }

  return NextResponse.json({ ok: true });
}