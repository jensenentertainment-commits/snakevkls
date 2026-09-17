import {
  mapShopifyVariant,
  SHOPIFY_CATALOG_QUERY,
  validateShopifyLocation,
  type ShopifyVariantNode,
  type ShopifyVariantPayload,
} from "./catalog-sync.ts";
import {
  paginateProductCollections,
  SHOPIFY_COLLECTIONS_QUERY,
} from "./collection-pagination.ts";
import type { ShopifySyncPage } from "./sync-engine.ts";

export type CatalogRequest = (
  query: string,
  variables: Record<string, string | null>,
) => Promise<unknown>;

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Sequential, uncached reads. Only throttling is retried inside a page;
 * all other errors use the existing sync checkpoint/reclaim mechanism.
 */
export function createCatalogRequest(input: {
  shop: string;
  apiVersion: string;
  accessToken: string;
  deadlineMs: number;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): CatalogRequest {
  const fetcher = input.fetch ?? fetch;
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? (
    (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  );
  const costs = new Map<string, number>();
  let budget: { available: number; restoreRate: number; receivedAt: number } | null = null;

  function remaining() {
    const ms = input.deadlineMs - now();
    if (!Number.isFinite(ms) || ms <= 0) {
      throw new Error("Shopify catalog page time budget exhausted; retry from checkpoint");
    }
    return ms;
  }

  async function wait(ms: number) {
    if (ms >= remaining()) {
      throw new Error("Shopify throttle wait exceeds page time budget; retry from checkpoint");
    }
    if (ms > 0) await sleep(ms);
    remaining();
  }

  function costDelay(query: string) {
    const requested = costs.get(query);
    if (!budget || requested === undefined || budget.restoreRate <= 0) return 0;
    const available = budget.available +
      (now() - budget.receivedAt) / 1000 * budget.restoreRate;
    return Math.max(0, Math.ceil((requested - available) / budget.restoreRate * 1000));
  }

  return async (query, variables) => {
    for (let attempt = 0; ; attempt += 1) {
      await wait(costDelay(query));
      const response = await fetcher(
        `https://${input.shop}/admin/api/${input.apiVersion}/graphql.json`,
        {
          method: "POST",
          cache: "no-store",
          signal: AbortSignal.timeout(
            Math.max(1, Math.min(15_000, Math.floor(remaining()))),
          ),
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": input.accessToken,
          },
          body: JSON.stringify({ query, variables }),
        },
      );
      // A 429 may contain a non-JSON body. Never treat it as a successful page.
      const json = object(await response.json().catch(() => null));
      remaining();
      const cost = object(object(json.extensions).cost);
      const throttle = object(cost.throttleStatus);
      if (finiteNumber(cost.requestedQueryCost)) {
        costs.set(query, cost.requestedQueryCost);
      }
      if (finiteNumber(throttle.currentlyAvailable) && finiteNumber(throttle.restoreRate)) {
        budget = {
          available: throttle.currentlyAvailable,
          restoreRate: throttle.restoreRate,
          receivedAt: now(),
        };
      }
      const errors = Array.isArray(json.errors) ? json.errors : [];
      const throttled = response.status === 429 || (
        response.ok && errors.length > 0 &&
        errors.every((error) => object(object(error).extensions).code === "THROTTLED")
      );
      if (throttled && attempt < 3) {
        const retryAfter = response.headers.get("Retry-After");
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const headerDelay = Number.isFinite(seconds)
          ? Math.max(0, seconds * 1000)
          : retryAfter ? Math.max(0, Date.parse(retryAfter) - now()) : 0;
        await wait(Math.max(
          1000 * 2 ** attempt,
          costDelay(query),
          Number.isFinite(headerDelay) ? headerDelay : 0,
        ));
        continue;
      }
      if (
        !response.ok || !json.data ||
        (json.errors !== undefined && (!Array.isArray(json.errors) || errors.length > 0))
      ) {
        throw new Error(
          `Shopify catalog API failed (${response.status}${throttled ? ", throttled" : ""})`,
        );
      }
      return json.data;
    }
  };
}

/**
 * One product snapshot per fetched variant page. No cache crosses an applied
 * checkpoint or a failed fetch, so resumed work always observes fresh membership.
 */
export async function fetchShopifyCatalogPage(input: {
  cursor: string | null;
  locationId: string;
  request: CatalogRequest;
  observedNow?: () => string;
}): Promise<ShopifySyncPage<ShopifyVariantPayload>> {
  const data = object(await input.request(SHOPIFY_CATALOG_QUERY, {
    cursor: input.cursor,
    locationId: input.locationId,
  }));
  // Receipt of the content response, independent of later collection traversal
  // and of both Shopify updatedAt and the eventual database write time.
  const contentObservedAt = (input.observedNow ?? (() => new Date().toISOString()))();
  validateShopifyLocation(
    data.location as Parameters<typeof validateShopifyLocation>[0],
    input.locationId,
  );
  const currencyCode = String(object(data.shop).currencyCode ?? "");
  const connection = object(data.productVariants);
  const pageInfo = object(connection.pageInfo);
  if (
    !Array.isArray(connection.edges) || typeof pageInfo.hasNextPage !== "boolean" ||
    (pageInfo.endCursor !== null && (typeof pageInfo.endCursor !== "string" || !pageInfo.endCursor.trim())) ||
    (pageInfo.hasNextPage && (!pageInfo.endCursor || pageInfo.endCursor === input.cursor))
  ) {
    throw new Error("Shopify returned invalid variant pagination");
  }
  const variants = connection.edges.map((edge) => object(edge).node as ShopifyVariantNode);
  const snapshots = new Map<string, Awaited<ReturnType<typeof paginateProductCollections>>>();
  const firstPages = new Map<string, string>();
  for (const variant of variants) {
    const product = variant?.product;
    if (!product || typeof product.id !== "string") {
      throw new Error("Shopify returned invalid product identity");
    }
    const firstPage = JSON.stringify(product.collections);
    if (snapshots.has(product.id)) {
      if (firstPages.get(product.id) !== firstPage) {
        throw new Error("Conflicting collection pages for the same Shopify product snapshot");
      }
      continue;
    }
    const snapshot = await paginateProductCollections({
      productId: product.id,
      firstPage: product.collections,
      async fetchPage(productId, cursor) {
        const result = object(await input.request(
          SHOPIFY_COLLECTIONS_QUERY, { productId, cursor },
        ));
        const product = object(result.product);
        if (product.id !== productId) {
          throw new Error("Shopify returned a missing or mismatched product");
        }
        return product.collections;
      },
    });
    snapshots.set(product.id, snapshot);
    firstPages.set(product.id, firstPage);
  }
  return {
    variants: variants.map((variant) => mapShopifyVariant(variant, {
      currencyCode,
      contentObservedAt,
      locationId: input.locationId,
      collectionObservation: snapshots.get(variant.product.id)!,
    })),
    endCursor: pageInfo.endCursor as string | null,
    hasNextPage: pageInfo.hasNextPage,
  };
}
