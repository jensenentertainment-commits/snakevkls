import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SHOPIFY_QUERY = `
  query ProductVariants($cursor: String) {
    productVariants(first: 100, after: $cursor, query: "product_status:active") {
      edges {
        cursor
        node {
          id
          sku
          title
          inventoryQuantity
          inventoryItem {
            id
          }
          product {
            id
            title
            status
            vendor
            productType
            featuredImage {
              url
            }
            collections(first: 20) {
              edges {
                node {
                  id
                  title
                  handle
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

type ShopifyCollectionNode = {
  id: string;
  title: string;
  handle: string | null;
};

type ShopifyVariantNode = {
  id: string;
  sku: string | null;
  title: string;
  inventoryQuantity: number;
  inventoryItem: {
    id: string;
  } | null;
  product: {
    id: string;
    title: string;
    status: string;
    vendor: string | null;
    productType: string | null;
    featuredImage: {
      url: string;
    } | null;
    collections: {
      edges: {
        node: ShopifyCollectionNode;
      }[];
    };
  };
};

export async function POST() {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-04";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!shop || !supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("shopify_connections")
    .select("shop, access_token")
    .eq("shop", shop)
    .single();

  if (connectionError || !connection?.access_token) {
    return NextResponse.json(
      {
        error: "Shopify er ikke koblet til",
        details: connectionError,
      },
      { status: 401 }
    );
  }

  let cursor: string | null = null;
  let hasNextPage = true;

  let imported = 0;
  let skippedNoSku = 0;
  let collectionsLinked = 0;

  while (hasNextPage) {
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": connection.access_token,
        },
        body: JSON.stringify({
          query: SHOPIFY_QUERY,
          variables: { cursor },
        }),
      }
    );

    const json = await response.json();

    if (!response.ok || json.errors) {
      return NextResponse.json(
        {
          error: "Shopify sync feilet",
          details: json.errors ?? json,
        },
        { status: 500 }
      );
    }

    const edges = json.data.productVariants.edges as {
      cursor: string;
      node: ShopifyVariantNode;
    }[];

    for (const edge of edges) {
      const variant = edge.node;
      const sku = variant.sku?.trim();

      if (variant.product.status !== "ACTIVE") continue;

      if (!sku) {
        skippedNoSku++;
        continue;
      }

      const row = {
        sku,
        product_name: variant.product.title,
        variant_name: variant.title === "Default Title" ? null : variant.title,
        active: true,
        image_url: variant.product.featuredImage?.url ?? null,
        vendor: variant.product.vendor ?? null,
        product_type: variant.product.productType ?? null,
        shopify_quantity: variant.inventoryQuantity ?? 0,
        shopify_product_id: variant.product.id,
        shopify_variant_id: variant.id,
        shopify_inventory_item_id: variant.inventoryItem?.id ?? null,
        shopify_status: variant.product.status,
        synced_at: new Date().toISOString(),
      };

      const { data: productData, error: productError } = await supabaseAdmin
        .from("products")
        .upsert(row, { onConflict: "sku" })
        .select("id")
        .single();

      if (productError || !productData?.id) {
        return NextResponse.json(
          {
            error: "Supabase product upsert feilet",
            details: productError,
            row,
          },
          { status: 500 }
        );
      }

      const localProductId = productData.id;

      await supabaseAdmin
        .from("product_collections")
        .delete()
        .eq("product_id", localProductId);

      const collections =
        variant.product.collections?.edges?.map((item) => item.node) ?? [];

      if (collections.length > 0) {
        const collectionRows = collections.map((collection) => ({
          product_id: localProductId,
          shopify_collection_id: collection.id,
          title: collection.title,
          handle: collection.handle,
        }));

        const { error: collectionsError } = await supabaseAdmin
          .from("product_collections")
          .upsert(collectionRows, {
            onConflict: "product_id,shopify_collection_id",
          });

        if (collectionsError) {
          return NextResponse.json(
            {
              error: "Supabase collection upsert feilet",
              details: collectionsError,
              collectionRows,
            },
            { status: 500 }
          );
        }

        collectionsLinked += collectionRows.length;
      }

      imported++;
    }

    hasNextPage = json.data.productVariants.pageInfo.hasNextPage;
    cursor = edges.length ? edges[edges.length - 1].cursor : null;
  }

  return NextResponse.json({
    ok: true,
    imported,
    skippedNoSku,
    collectionsLinked,
  });
}