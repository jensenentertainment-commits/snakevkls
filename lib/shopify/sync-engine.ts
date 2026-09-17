export type ShopifySyncClaim = {
  acquired: boolean;
  resumed?: boolean;
  runId: string;
  status: "running" | "paused" | "failed" | "completed";
  cursor: string | null;
  hasNextPage: boolean;
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

export type ShopifySyncStoredRun = ShopifySyncCompleted | (
  Omit<ShopifySyncProgress, "status" | "leaseExpiresAt"> & {
    status: "running" | "paused" | "failed";
    leaseExpiresAt: string | null;
  }
);

/** A received SQL rejection proves rollback; a transport error does not. */
export class ShopifySyncWriteRejectedError extends Error {}

export class ShopifySyncRecoveryRequiredError extends Error {
  constructor(runId: string, state: ShopifySyncStoredRun | null) {
    super(state
      ? `Shopify sync ${runId} requires reclaim from persisted state (${state.status}, ${state.pagesProcessed} pages); the write was not retried`
      : `Shopify sync ${runId} outcome is unresolved; leave the lease to expire and recover persisted state`);
    this.name = "ShopifySyncRecoveryRequiredError";
  }
}

export type ShopifySyncWorker<TVariant> = {
  claim(): Promise<ShopifySyncClaim>;
  readRun(runId: string): Promise<ShopifySyncStoredRun>;
  fetchPage(cursor: string | null): Promise<ShopifySyncPage<TVariant>>;
  applyPage(input: {
    runId: string;
    leaseToken: string;
    expectedCursor: string | null;
    expectedPagesProcessed: number;
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
  let pagesProcessed = claim.pagesProcessed;
  let pendingWrite = false;
  let pagesThisInvocation = 0;
  let progress: ShopifySyncProgress | null = null;

  try {
    if (typeof claim.hasNextPage !== "boolean" ||
      !Number.isSafeInteger(pagesProcessed) || pagesProcessed < 0 ||
      (!claim.hasNextPage && pagesProcessed === 0)) {
      throw new Error("Shopify sync claim is missing valid persisted pagination state");
    }

    async function completeRun() {
      pendingWrite = true;
      const completed = await worker.complete({
        runId: claim.runId,
        leaseToken: claim.leaseToken!,
      });
      if (completed.runId !== claim.runId || completed.status !== "completed" ||
        completed.pagesProcessed !== pagesProcessed ||
        !Number.isFinite(Date.parse(completed.startedAt)) ||
        !Number.isFinite(Date.parse(completed.completedAt))) {
        throw new Error("Shopify completion acknowledgement does not match the requested run");
      }
      pendingWrite = false;
      return completed;
    }

    if (!claim.hasNextPage) return await completeRun();

    while (pagesThisInvocation < maxPages && now() - startedAt < softDurationMs) {
      const page = await worker.fetchPage(cursor);

      if (page.hasNextPage && !page.endCursor) {
        throw new Error("Shopify returnerte neste side uten cursor");
      }

      pendingWrite = true;
      progress = await worker.applyPage({
        runId: claim.runId,
        leaseToken: claim.leaseToken,
        expectedCursor: cursor,
        expectedPagesProcessed: pagesProcessed,
        page,
      });
      if (progress.runId !== claim.runId || progress.status !== "running" || progress.pagesProcessed !== pagesProcessed + 1 ||
        progress.cursor !== page.endCursor || progress.hasNextPage !== page.hasNextPage) {
        throw new Error("Shopify page acknowledgement does not match the requested checkpoint");
      }
      pendingWrite = false;

      pagesThisInvocation += 1;
      pagesProcessed = progress.pagesProcessed;
      cursor = page.endCursor;

      if (!page.hasNextPage) {
        return await completeRun();
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
    if (pendingWrite) {
      let stored: ShopifySyncStoredRun;
      try {
        stored = await worker.readRun(claim.runId);
        if (stored.runId !== claim.runId) throw new Error("Wrong sync run returned");
      } catch {
        // A failed read cannot establish whether the write committed. In
        // particular, do not mark this run failed or retry an in-flight write.
        throw new ShopifySyncRecoveryRequiredError(claim.runId, null);
      }
      if (stored.status === "completed") return stored;
      if (!(error instanceof ShopifySyncWriteRejectedError) ||
        stored.status !== "running" || stored.pagesProcessed !== pagesProcessed ||
        stored.cursor !== cursor) {
        // Even an unchanged read can race an in-flight transaction. Fence it
        // through normal lease expiry/reclaim rather than assuming rollback.
        throw new ShopifySyncRecoveryRequiredError(claim.runId, stored);
      }
    }
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
