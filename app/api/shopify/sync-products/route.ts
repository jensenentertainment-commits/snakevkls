import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { syncShopifyProducts } from "@/lib/shopify/sync-products";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
 const auth = await requireRole(["admin"]);

if (!auth.ok) return auth.response;

const { user } = auth;

  try {
    const result = await syncShopifyProducts({
      actorEmail: user.email ?? null,
      source: "manual",
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shopify sync feilet";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}