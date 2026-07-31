import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const ORDER_PREVIEW_QUERY = `#graphql
  query ViperOrderPreview($id: ID!) {
    order(id: $id) {
      id
      legacyResourceId
      name
      createdAt
      updatedAt
      cancelledAt
      closed
      fulfillable
      displayFinancialStatus
      displayFulfillmentStatus
      lineItems(first: 100) {
        nodes {
          id
          title
          variantTitle
          sku
          unfulfilledQuantity
          requiresShipping
          variant {
            id
            sku
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  }
`;

export type ShopifyOrderPayload = {
  id: string;
  legacyResourceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  closed: boolean;
  fulfillable: boolean;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  lineItems: {
    nodes: Array<{
      id: string;
      title: string;
      variantTitle: string | null;
      sku: string | null;
      unfulfilledQuantity: number;
      requiresShipping: boolean;
      variant: { id: string; sku: string | null } | null;
    }>;
    pageInfo: { hasNextPage: boolean };
  };
};

type ShopifyGraphqlResponse = {
  data?: { order: ShopifyOrderPayload | null };
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

export class ShopifyOrderClientError extends Error {
  constructor(
    message: string,
    public readonly code: "AUTH_SCOPE_MISSING" | "SHOPIFY_ERROR"
  ) {
    super(message);
  }
}

export async function fetchShopifyOrderForPreview(orderId: string) {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-04";
  if (!shop) throw new ShopifyOrderClientError("Shopify er ikke konfigurert.", "SHOPIFY_ERROR");

  const { data: connection, error } = await getSupabaseAdmin()
    .from("shopify_connections")
    .select("access_token, scopes")
    .eq("shop", shop)
    .single();

  if (error || !connection?.access_token) {
    throw new ShopifyOrderClientError("Shopify er ikke koblet til.", "SHOPIFY_ERROR");
  }

  const scopes = String(connection.scopes ?? "")
    .split(",")
    .map((scope) => scope.trim());
  if (!scopes.includes("read_orders")) {
    throw new ShopifyOrderClientError(
      "Shopify-tilkoblingen mangler read_orders. Koble Shopify til på nytt.",
      "AUTH_SCOPE_MISSING"
    );
  }

  const response = await fetch(
    `https://${shop}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": String(connection.access_token),
      },
      body: JSON.stringify({
        query: ORDER_PREVIEW_QUERY,
        variables: { id: orderId },
      }),
      cache: "no-store",
    }
  );
  const payload = (await response.json()) as ShopifyGraphqlResponse;

  if (!response.ok || payload.errors?.length) {
    const denied = payload.errors?.some((item) =>
      /access|scope|permission/i.test(item.message ?? "")
    );
    throw new ShopifyOrderClientError(
      denied
        ? "Shopify-tilkoblingen har ikke tilgang til ordre."
        : "Shopify kunne ikke hente ordren.",
      denied ? "AUTH_SCOPE_MISSING" : "SHOPIFY_ERROR"
    );
  }

  return payload.data?.order ?? null;
}
