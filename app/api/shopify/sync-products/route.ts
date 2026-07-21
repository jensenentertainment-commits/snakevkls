import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  getLatestShopifySyncRun,
  syncShopifyProducts,
} from "@/lib/shopify/sync-products";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const auth = await requireRole(["admin"]);

  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(await getLatestShopifySyncRun());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunne ikke hente sync-status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
 const auth = await requireRole(["admin"]);

if (!auth.ok) return auth.response;

const { user } = auth;

  try {
    const result = await syncShopifyProducts({
      actorEmail: user.email ?? null,
      source: "manual",
    });

    return NextResponse.json(result, {
      status: result.status === "completed" ? 200 : 202,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shopify sync feilet";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
