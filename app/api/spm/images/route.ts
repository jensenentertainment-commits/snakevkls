import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { convertImages } from "@/lib/spm/convert-images";
import { saveSpmStatus } from "@/lib/spm/status";

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));

  const limit =
    body.limit === undefined || body.limit === null || body.limit === ""
      ? undefined
      : Number(body.limit);

  const result = await convertImages(limit);
await saveSpmStatus({ images: result });
  return NextResponse.json(result);
}