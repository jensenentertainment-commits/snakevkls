import { isDeepStrictEqual } from "node:util";
import type { ShopifyVariantPayload } from "./catalog-sync.ts";
import {
  ShopifySyncWriteRejectedError,
  type ShopifySyncStoredRun,
} from "./sync-engine.ts";

export function prepareShopifyPersistencePage(variants: ShopifyVariantPayload[]) {
  const products = new Map<string, {
    productContent: ShopifyVariantPayload["productContent"];
    collectionObservation: ShopifyVariantPayload["collectionObservation"];
  }>();
  for (const variant of variants) {
    if (variant.productContent.shopifyProductId !== variant.shopifyProductId ||
      variant.collectionObservation.state !== "complete") {
      throw new ShopifySyncWriteRejectedError("Invalid canonical product snapshot");
    }
    const snapshot = {
      productContent: variant.productContent,
      collectionObservation: variant.collectionObservation,
    };
    const previous = products.get(variant.shopifyProductId);
    if (previous && !isDeepStrictEqual(previous, snapshot)) {
      throw new ShopifySyncWriteRejectedError("Conflicting snapshots for the same Shopify product");
    }
    if (!isDeepStrictEqual(variant.collections, snapshot.collectionObservation.collections)) {
      throw new ShopifySyncWriteRejectedError("Legacy and canonical collection membership disagree");
    }
    products.set(variant.shopifyProductId, snapshot);
  }
  return {
    // Retain the legacy payload shape without repeating new content metadata.
    variants: variants.map(({ productContent, collectionObservation, ...legacy }) => {
      void productContent;
      void collectionObservation;
      return legacy;
    }),
    products: [...products.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
  };
}

export function syncWriteResult<T>(
  data: unknown,
  error: { message: string; code?: string } | null,
): T {
  if (error) {
    // SQL data/constraint/transaction/access/PLpgSQL errors are explicit
    // rejections. Connection errors and malformed/absent responses remain
    // ambiguous and are reconciled by the engine through the stored run.
    if (/^(22|23|40|42|P0)[A-Z0-9]{3}$/.test(error.code ?? "")) {
      throw new ShopifySyncWriteRejectedError(error.message);
    }
    throw new Error(error.message);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Shopify sync write returned an invalid acknowledgement");
  }
  return data as T;
}

export function parseStoredSyncRun(data: unknown, runId: string): ShopifySyncStoredRun {
  if (!data || typeof data !== "object") throw new Error("Missing persisted sync state");
  const value = data as Record<string, unknown>;
  if (value.runId !== runId) throw new Error("Persisted sync run ID mismatch");
  for (const key of ["pagesProcessed", "processedCount", "skippedNoSku", "collectionsLinked", "reconciledCount"]) {
    if (!Number.isSafeInteger(value[key]) || (value[key] as number) < 0) {
      throw new Error(`Invalid persisted sync ${key}`);
    }
  }
  const counts = {
    runId,
    pagesProcessed: value.pagesProcessed as number,
    processedCount: value.processedCount as number,
    skippedNoSku: value.skippedNoSku as number,
    collectionsLinked: value.collectionsLinked as number,
  };
  if (typeof value.hasNextPage !== "boolean" ||
    (value.cursor !== null && typeof value.cursor !== "string")) {
    throw new Error("Invalid persisted pagination state");
  }
  if (value.status === "completed") {
    if (value.hasNextPage || counts.pagesProcessed === 0 ||
      typeof value.startedAt !== "string" || !Number.isFinite(Date.parse(value.startedAt)) ||
      typeof value.completedAt !== "string" || !Number.isFinite(Date.parse(value.completedAt))) {
      throw new Error("Invalid persisted completion state");
    }
    return {
      ...counts, status: "completed", startedAt: value.startedAt,
      completedAt: value.completedAt, reconciledCount: value.reconciledCount as number,
    };
  }
  if (!["running", "paused", "failed"].includes(String(value.status)) ||
    (value.leaseExpiresAt !== null && typeof value.leaseExpiresAt !== "string")) {
    throw new Error("Invalid persisted run status");
  }
  return {
    ...counts, status: value.status as "running" | "paused" | "failed",
    cursor: value.cursor as string | null, hasNextPage: value.hasNextPage,
    leaseExpiresAt: value.leaseExpiresAt as string | null,
  };
}
