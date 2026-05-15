import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

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

type SyncOptions = {
  actorEmail?: string | null;
  source?: "manual" | "cron";
};

async function logShopifySync(
  supabaseAdmin: SupabaseClient,
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

  if (error) {
    console.error("Kunne ikke logge Shopify-sync:", error);
  }
}

export async function syncShopifyProducts(options: SyncOptions = {}) {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-04";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!shop || !supabaseUrl || !supabaseServiceKey) {
    throw new Error("Mangler env vars");
  }

 const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey
);

  const startedAt = Date.now();

  await logShopifySync(supabaseAdmin, {
    action: "shopify_sync_started",
    title: "Shopify-sync startet",
    actorEmail: options.actorEmail ?? null,
    metadata: {
      source: options.source ?? "manual",
    },
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
      actorEmail: options.actorEmail ?? null,
      metadata: {
        source: options.source ?? "manual",
        duration_ms: Date.now() - startedAt,
      },
    });

    throw new Error("Shopify er ikke koblet til");
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
        actorEmail: options.actorEmail ?? null,
        metadata: {
          source: options.source ?? "manual",
          duration_ms: Date.now() - startedAt,
          status: response.status,
        },
      });

      throw new Error("Shopify sync feilet");
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

        throw new Error("Kunne ikke synkronisere produkter");
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

          throw new Error("Kunne ikke synkronisere collections");
        }

        collectionsLinked += collectionRows.length;
      }

      imported++;
    }

    hasNextPage = json.data.productVariants.pageInfo.hasNextPage;
    cursor = edges.length ? edges[edges.length - 1].cursor : null;
  }

  const durationMs = Date.now() - startedAt;

  await logShopifySync(supabaseAdmin, {
    action: "shopify_sync_completed",
    title: "Shopify-sync fullført",
    description: `${imported} produkter synkronisert`,
    actorEmail: options.actorEmail ?? null,
    metadata: {
      source: options.source ?? "manual",
      duration_ms: durationMs,
      imported,
      skipped_no_sku: skippedNoSku,
      collections_linked: collectionsLinked,
    },
  });

  return {
    ok: true,
    imported,
    skippedNoSku,
    collectionsLinked,
    durationMs,
  };
}