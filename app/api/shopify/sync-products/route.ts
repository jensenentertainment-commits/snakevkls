
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

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

async function logShopifySync(
  supabaseAdmin: any,
  {
    action,
    title,
    description,
    metadata,
    actorEmail,
  }: {
    action: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
    actorEmail?: string | null;
  }
) {
  const { error } = await supabaseAdmin.from("activity_log").insert({
    entity_type: "shopify_sync",
    entity_id: null,
    action,
    title,
    description: description ?? null,
    actor_email: actorEmail ?? null,
    metadata: metadata ?? null,
  });
}

export async function POST(request: NextRequest) {
  // AUTH CHECK
  const authClient = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Ikke innlogget" },
      { status: 401 }
    );
  }

  // ROLE CHECK
  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Mangler admin-tilgang" },
      { status: 403 }
    );
  }

  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-04";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!shop || !supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Mangler env vars" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createSupabaseAdminClient(
    supabaseUrl,
    supabaseServiceKey
  );

  const startedAt = Date.now();

  await logShopifySync(supabaseAdmin, {
    action: "shopify_sync_started",
    title: "Shopify-sync startet",
  });

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("shopify_connections")
    .select("shop, access_token")
    .eq("shop", shop)
    .single();

  if (connectionError || !connection?.access_token) {
    await logShopifySync(supabaseAdmin, {
      action: "shopify_sync_failed",
      title: "Shopify-sync feilet",
      description: "Shopify er ikke koblet til",
      metadata: {
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json(
      {
        error: "Shopify er ikke koblet til",
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
      await logShopifySync(supabaseAdmin, {
        action: "shopify_sync_failed",
        title: "Shopify-sync feilet",
        description: "Shopify API returnerte feil",
        metadata: {
          duration_ms: Date.now() - startedAt,
          status: response.status,
        },
      });

      return NextResponse.json(
        {
          error: "Shopify sync feilet",
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
        variant_name:
          variant.title === "Default Title" ? null : variant.title,
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
        console.error("Supabase product upsert feilet", {
          productError,
          row,
        });

        return NextResponse.json(
          {
            error: "Kunne ikke synkronisere produkter",
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
          console.error("Collection upsert feilet", collectionsError);

          return NextResponse.json(
            {
              error: "Kunne ikke synkronisere collections",
            },
            { status: 500 }
          );
        }

        collectionsLinked += collectionRows.length;
      }

      imported++;
    }

    hasNextPage = json.data.productVariants.pageInfo.hasNextPage;

    cursor = edges.length
      ? edges[edges.length - 1].cursor
      : null;
  }

  await logShopifySync(supabaseAdmin, {
    action: "shopify_sync_completed",
    title: "Shopify-sync fullført",
    description: `${imported} produkter synkronisert`,
    metadata: {
      duration_ms: Date.now() - startedAt,
      imported,
      skipped_no_sku: skippedNoSku,
      collections_linked: collectionsLinked,
    },
  });

  return NextResponse.json({
    ok: true,
    imported,
    skippedNoSku,
    collectionsLinked,
     durationMs: Date.now() - startedAt,
  });
}

