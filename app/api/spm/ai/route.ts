import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { generateAiProducts } from "@/lib/spm/generate-ai-products";
import { saveSpmStatus } from "@/lib/spm/status";

export async function POST(
  request: Request
) {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request
    .json()
    .catch(() => ({}));

  const limit =
    body.limit !== undefined &&
    body.limit !== null &&
    body.limit !== ""
      ? Number(body.limit)
      : undefined;

  const result =
    await generateAiProducts(limit);

  await saveSpmStatus({
    ai: result,
  });

  return NextResponse.json(result);
}