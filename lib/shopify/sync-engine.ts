export type ShopifySyncClaim = {
  acquired: boolean;
  resumed?: boolean;
  runId: string;
  status: "running" | "paused" | "failed" | "completed";
  cursor: string | null;
  processedCount: number;
  pagesProcessed: number;
  errorMessage?: string | null;
  leaseToken?: string;
  leaseExpiresAt?: string;
};

export type ShopifySyncPage<TVariant> = {
  variants: TVariant[];
  endCursor: string | null;
  hasNextPage: boolean;
};

export type ShopifySyncProgress = {
  runId: string;
  status: "running";
  cursor: string | null;
  hasNextPage: boolean;
  processedCount: number;
  skippedNoSku: number;
  collectionsLinked: number;
  pagesProcessed: number;
  leaseExpiresAt: string;
};

export type ShopifySyncCompleted = {
  runId: string;
  status: "completed";
  startedAt: string;
  completedAt: string;
  processedCount: number;
  skippedNoSku: number;
  collectionsLinked: number;
  pagesProcessed: number;
  reconciledCount: number;
};

export type ShopifySyncResult =
  | ShopifySyncCompleted
  | (Omit<ShopifySyncProgress, "status"> & {
      status: "paused";
      paused: true;
    })
  | {
      runId: string;
      status: "running";
      acquired: false;
      cursor: string | null;
      processedCount: number;
      pagesProcessed: number;
      leaseExpiresAt?: string;
    };

export type ShopifySyncWorker<TVariant> = {
  claim(): Promise<ShopifySyncClaim>;
  fetchPage(cursor: string | null): Promise<ShopifySyncPage<TVariant>>;
  applyPage(input: {
    runId: string;
    leaseToken: string;
    expectedCursor: string | null;
    page: ShopifySyncPage<TVariant>;
  }): Promise<ShopifySyncProgress>;
  complete(input: {
    runId: string;
    leaseToken: string;
  }): Promise<ShopifySyncCompleted>;
  pause(input: {
    runId: string;
    leaseToken: string;
    reason: string;
  }): Promise<void>;
  fail(input: {
    runId: string;
    leaseToken: string;
    error: string;
  }): Promise<void>;
};

type RunOptions = {
  maxPages?: number;
  softDurationMs?: number;
  now?: () => number;
};

export async function runPagedShopifySync<TVariant>(
  worker: ShopifySyncWorker<TVariant>,
  options: RunOptions = {}
): Promise<ShopifySyncResult> {
  const claim = await worker.claim();

  if (!claim.acquired) {
    return {
      runId: claim.runId,
      status: "running",
      acquired: false,
      cursor: claim.cursor,
      processedCount: claim.processedCount,
      pagesProcessed: claim.pagesProcessed,
      leaseExpiresAt: claim.leaseExpiresAt,
    };
  }

  if (!claim.leaseToken) {
    throw new Error("Shopify-sync mangler worker lease");
  }

  const now = options.now ?? Date.now;
  const startedAt = now();
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const softDurationMs = options.softDurationMs ?? 240_000;

  let cursor = claim.cursor;
  let pagesThisInvocation = 0;
  let progress: ShopifySyncProgress | null = null;

  try {
    while (pagesThisInvocation < maxPages && now() - startedAt < softDurationMs) {
      const page = await worker.fetchPage(cursor);

      if (page.hasNextPage && !page.endCursor) {
        throw new Error("Shopify returnerte neste side uten cursor");
      }

      progress = await worker.applyPage({
        runId: claim.runId,
        leaseToken: claim.leaseToken,
        expectedCursor: cursor,
        page,
      });

      pagesThisInvocation += 1;
      cursor = page.endCursor;

      if (!page.hasNextPage) {
        return await worker.complete({
          runId: claim.runId,
          leaseToken: claim.leaseToken,
        });
      }
    }

    if (!progress) {
      throw new Error("Shopify-sync stoppet før første side ble behandlet");
    }

    await worker.pause({
      runId: claim.runId,
      leaseToken: claim.leaseToken,
      reason: "Kjøringen stoppet kontrollert før funksjonens tidsgrense.",
    });

    return { ...progress, status: "paused", paused: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ukjent feil i Shopify-sync";

    try {
      await worker.fail({
        runId: claim.runId,
        leaseToken: claim.leaseToken,
        error: message,
      });
    } catch (failError) {
      console.error("Kunne ikke markere Shopify-sync som feilet", failError);
    }

    throw error;
  }
}
