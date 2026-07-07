import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { countProducts } from "@/lib/spm/count-products";
import { saveSpmStatus } from "@/lib/spm/status";

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  const importPath = String(body.importPath || "");

  if (!importPath) {
    return NextResponse.json(
      { error: "Mangler importmappe" },
      { status: 400 }
    );
  }

  const result = await countProducts(importPath);

  await saveSpmStatus({
  importPath,
  count: result,
});

  return NextResponse.json(result);
}