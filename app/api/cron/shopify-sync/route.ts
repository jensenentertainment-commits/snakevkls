import { NextResponse, type NextRequest } from "next/server";
import { syncShopifyProducts } from "@/lib/shopify/sync-products";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET mangler" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Ugyldig cron-token" },
      { status: 401 }
    );
  }

  try {
    const result = await syncShopifyProducts({
      actorEmail: "cron@snake.local",
      source: "cron",
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cron Shopify sync feilet";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}