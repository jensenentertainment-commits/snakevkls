import { createClient } from "@supabase/supabase-js";

export async function shopifyGraphql<T = any>({
  query,
  variables,
}: {
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-04";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!shop || !supabaseUrl || !supabaseServiceKey) {
    throw new Error("Mangler env vars");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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