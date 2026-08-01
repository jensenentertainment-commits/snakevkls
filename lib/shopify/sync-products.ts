import type { SupabaseClient } from "@supabase/supabase-js";
import { tryGetSupabaseAdmin } from "@/lib/supabase/admin";
import {
  runPagedShopifySync,
  type ShopifySyncClaim,
  type ShopifySyncCompleted,
  type ShopifySyncPage,
  type ShopifySyncProgress,
  type ShopifySyncWorker,
} from "@/lib/shopify/sync-engine";
import {
  mapShopifyVariant,
  SHOPIFY_CATALOG_QUERY,
  validateShopifyLocation,
  type ShopifyVariantNode,
  type ShopifyVariantPayload,
} from "@/lib/shopify/catalog-sync";

type SyncOptions = {
  actorEmail?: string | null;
  source?: "manual" | "cron";
  maxPages?: number;
  softDurationMs?: number;
};

async function logShopifySync(
  supabaseAdmin: SupabaseClient,
  input: {
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
    action: input.action,
    title: input.title,
    description: input.description ?? null,
    actor_email: input.actorEmail ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    console.error("Kunne ikke logge Shopify-sync", error);
  }
}

function rpcResult<T>(data: unknown, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") {
    throw new Error("Shopify-sync fikk ugyldig svar fra databasen");
  }
  return data as T;
}

export async function syncShopifyProducts(options: SyncOptions = {}) {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2026-04";
  const supabaseAdmin = tryGetSupabaseAdmin();

  if (!shop || !supabaseAdmin) {
    throw new Error("Mangler env vars");
  }
  const adminClient = supabaseAdmin;

  const source = options.source ?? "manual";

  let connectionConfig:
    | {
        accessToken: string;
        inventoryLocationId: string;
      }
    | null = null;

  async function getConnectionConfig() {
    if (connectionConfig) return connectionConfig;

    const { data: connection, error } = await adminClient
      .from("shopify_connections")
      .select("access_token, inventory_location_id")
      .eq("shop", shop)
      .single();

    if (error || !connection?.access_token) {
      throw new Error("Shopify er ikke koblet til");
    }

    const inventoryLocationId = String(
      connection.inventory_location_id ?? ""
    ).trim();

    if (!inventoryLocationId) {
      throw new Error(
        "Shopify-lokasjon for Snake-lageret er ikke konfigurert"
      );
    }

    connectionConfig = {
      accessToken: String(connection.access_token),
      inventoryLocationId,
    };
    return connectionConfig;
  }

  const worker: ShopifySyncWorker<ShopifyVariantPayload> = {
    async claim() {
      const { data, error } = await supabaseAdmin.rpc(
        "claim_shopify_sync_run",
        {
          requested_source: source,
          requested_actor_email: options.actorEmail ?? null,
          requested_lease_seconds: 90,
        }
      );
      const claim = rpcResult<ShopifySyncClaim>(data, error);

      if (claim.acquired) {
        await logShopifySync(supabaseAdmin, {
          action: claim.resumed
            ? "shopify_sync_resumed"
            : "shopify_sync_started",
          title: claim.resumed
            ? "Shopify-sync fortsetter"
            : "Shopify-sync startet",
          description: claim.errorMessage ?? null,
          actorEmail: options.actorEmail ?? null,
          metadata: {
            run_id: claim.runId,
            source,
            cursor: claim.cursor,
            processed: claim.processedCount,
          },
        });
      }

      return claim;
    },

    async fetchPage(cursor): Promise<ShopifySyncPage<ShopifyVariantPayload>> {
      const config = await getConnectionConfig();
      const response = await fetch(
        `https://${shop}/admin/api/${apiVersion}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": config.accessToken,
          },
          body: JSON.stringify({
            query: SHOPIFY_CATALOG_QUERY,
            variables: {
              cursor,
              locationId: config.inventoryLocationId,
            },
          }),
        }
      );
      const json = await response.json();

      if (!response.ok || json.errors) {
        console.error("Shopify GraphQL-feil", {
          status: response.status,
          errors: json.errors ?? null,
        });
        throw new Error(`Shopify API returnerte feil (${response.status})`);
      }

      const connection = json.data?.productVariants;
      const currencyCode = String(json.data?.shop?.currencyCode ?? "");
      validateShopifyLocation(
        json.data?.location,
        config.inventoryLocationId
      );
      if (!connection || !Array.isArray(connection.edges)) {
        throw new Error("Shopify returnerte ugyldig produktdata");
      }

      return {
        variants: connection.edges.map(
          ({ node: variant }: { node: ShopifyVariantNode }) =>
            mapShopifyVariant(variant, {
              currencyCode,
              locationId: config.inventoryLocationId,
            })
        ),
        endCursor: connection.pageInfo?.endCursor ?? null,
        hasNextPage: Boolean(connection.pageInfo?.hasNextPage),
      };
    },

    async applyPage({ runId, leaseToken, expectedCursor, page }) {
      const { data, error } = await supabaseAdmin.rpc(
        "apply_shopify_sync_page",
        {
          requested_run_id: runId,
          requested_lease_token: leaseToken,
          expected_cursor: expectedCursor,
          next_cursor: page.endCursor,
          page_has_next: page.hasNextPage,
          page_variants: page.variants,
          page_lease_seconds: 90,
        }
      );
      return rpcResult<ShopifySyncProgress>(data, error);
    },

    async complete({ runId, leaseToken }) {
      const { data, error } = await supabaseAdmin.rpc(
        "complete_shopify_sync_run",
        {
          requested_run_id: runId,
          requested_lease_token: leaseToken,
        }
      );
      const completed = rpcResult<ShopifySyncCompleted>(data, error);

      await logShopifySync(supabaseAdmin, {
        action: "shopify_sync_completed",
        title: "Shopify-sync fullført",
        description: `${completed.processedCount} produkter synkronisert`,
        actorEmail: options.actorEmail ?? null,
        metadata: {
          run_id: completed.runId,
          source,
          imported: completed.processedCount,
          skipped_no_sku: completed.skippedNoSku,
          collections_linked: completed.collectionsLinked,
          pages_processed: completed.pagesProcessed,
          reconciled: completed.reconciledCount,
        },
      });

      return completed;
    },

    async pause({ runId, leaseToken, reason }) {
      const { error } = await supabaseAdmin.rpc("pause_shopify_sync_run", {
        requested_run_id: runId,
        requested_lease_token: leaseToken,
        requested_reason: reason,
      });

      if (error) throw new Error(error.message);

      await logShopifySync(supabaseAdmin, {
        action: "shopify_sync_paused",
        title: "Shopify-sync pauset",
        description: reason,
        actorEmail: options.actorEmail ?? null,
        metadata: { run_id: runId, source },
      });
    },

    async fail({ runId, leaseToken, error: message }) {
      const { error } = await supabaseAdmin.rpc("fail_shopify_sync_run", {
        requested_run_id: runId,
        requested_lease_token: leaseToken,
        requested_error_message: message,
      });

      if (error) throw new Error(error.message);

      await logShopifySync(supabaseAdmin, {
        action: "shopify_sync_failed",
        title: "Shopify-sync feilet",
        description: message,
        actorEmail: options.actorEmail ?? null,
        metadata: { run_id: runId, source },
      });
    },
  };

  const result = await runPagedShopifySync(worker, {
    maxPages: options.maxPages,
    softDurationMs: options.softDurationMs,
  });

  return {
    ok: result.status === "completed",
    ...result,
  };
}

export async function getLatestShopifySyncRun() {
  const supabaseAdmin = tryGetSupabaseAdmin();

  if (!supabaseAdmin) {
    throw new Error("Mangler env vars");
  }
  const { data, error } = await supabaseAdmin.rpc("get_shopify_sync_run", {
    requested_run_id: null,
  });

  return rpcResult<Record<string, unknown>>(data, error);
}
