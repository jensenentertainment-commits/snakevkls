import { tryGetSupabaseAdmin } from "@/lib/supabase/admin";

export async function shopifyGraphql<T = any>({
  query,
  variables,
}: {
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-04";

  const supabaseAdmin = tryGetSupabaseAdmin();

  if (!shop || !supabaseAdmin) {
    throw new Error("Mangler env vars");
  }

  const { data: connection, error } = await supabaseAdmin
    .from("shopify_connections")
    .select("shop, access_token")
    .eq("shop", shop)
    .single();

  if (error || !connection?.access_token) {
    throw new Error("Shopify er ikke koblet til");
  }

  const response = await fetch(
    `https://${shop}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": connection.access_token,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    }
  );

  const json = await response.json();

  if (!response.ok || json.errors) {
    console.error("Shopify GraphQL-feil:", json.errors ?? json);
    throw new Error("Shopify API returnerte feil");
  }

  return json.data as T;
}
