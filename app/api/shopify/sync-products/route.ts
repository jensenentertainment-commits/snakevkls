import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { syncShopifyProducts } from "@/lib/shopify/sync-products";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authClient = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Mangler admin-tilgang" },
      { status: 403 }
    );
  }

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