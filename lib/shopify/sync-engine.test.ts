import assert from "node:assert/strict";
import test from "node:test";
import {
  runPagedShopifySync,
  type ShopifySyncWorker,
} from "./sync-engine.ts";

function progress(cursor: string | null, pagesProcessed: number) {
  return {
    runId: "run-1",
    status: "running" as const,
    cursor,
    hasNextPage: pagesProcessed < 2,
    processedCount: pagesProcessed,
    skippedNoSku: 0,
    collectionsLinked: 0,
    pagesProcessed,
    leaseExpiresAt: "2026-07-21T12:00:00Z",
  };
}

test("completes only after the final page is applied", async () => {
  const events: string[] = [];
  const pages = [
    { variants: ["first"], endCursor: "cursor-1", hasNextPage: true },
    { variants: ["second"], endCursor: "cursor-2", hasNextPage: false },
  ];

  const worker: ShopifySyncWorker<string> = {
    async claim() {
      events.push("claim");
      return {
        acquired: true,
        runId: "run-1",
        status: "running",
        cursor: null,
        processedCount: 0,
        pagesProcessed: 0,
        leaseToken: "lease-1",
      };
    },
    async fetchPage(cursor) {
      events.push(`fetch:${cursor ?? "start"}`);
      return pages.shift()!;
    },
    async applyPage({ page }) {
      events.push(`apply:${page.endCursor}`);
      return progress(page.endCursor, page.hasNextPage ? 1 : 2);
    },
    async complete() {
      events.push("complete");
      return {
        runId: "run-1",
        status: "completed",
        startedAt: "2026-07-21T11:00:00Z",
        completedAt: "2026-07-21T11:01:00Z",
        processedCount: 2,
        skippedNoSku: 0,
        collectionsLinked: 0,
        pagesProcessed: 2,
        reconciledCount: 1,
      };
    },
    async pause() {
      assert.fail("completed sync must not pause");
    },
    async fail() {
      assert.fail("completed sync must not fail");
    },
  };

  const result = await runPagedShopifySync(worker);

  assert.equal(result.status, "completed");
  assert.deepEqual(events, [
    "claim",
    "fetch:start",
    "apply:cursor-1",
    "fetch:cursor-1",
    "apply:cursor-2",
    "complete",
  ]);
});

test("persists a cursor and resumes an interrupted sync", async () => {
  let storedCursor: string | null = null;
  let pagesProcessed = 0;
  let paused = false;
  const fetchedCursors: (string | null)[] = [];

  function createWorker(resumed: boolean): ShopifySyncWorker<string> {
    return {
      async claim() {
        return {
          acquired: true,
          resumed,
          runId: "run-1",
          status: "running",
          cursor: storedCursor,
          processedCount: pagesProcessed,
          pagesProcessed,
          leaseToken: resumed ? "lease-2" : "lease-1",
        };
      },
      async fetchPage(cursor) {
        fetchedCursors.push(cursor);
        return cursor === null
          ? {
              variants: ["first"],
              endCursor: "cursor-1",
              hasNextPage: true,
            }
          : {
              variants: ["second"],
              endCursor: "cursor-2",
              hasNextPage: false,
            };
      },
      async applyPage({ page }) {
        storedCursor = page.endCursor;
        pagesProcessed += 1;
        return progress(storedCursor, pagesProcessed);
      },
      async complete() {
        return {
          runId: "run-1",
          status: "completed",
          startedAt: "2026-07-21T11:00:00Z",
          completedAt: "2026-07-21T11:02:00Z",
          processedCount: 2,
          skippedNoSku: 0,
          collectionsLinked: 0,
          pagesProcessed,
          reconciledCount: 0,
        };
      },
      async pause() {
        paused = true;
      },
      async fail() {
        assert.fail("interrupted sync must remain resumable");
      },
    };
  }

  const interrupted = await runPagedShopifySync(createWorker(false), {
    maxPages: 1,
  });
  assert.equal(interrupted.status, "running");
  assert.equal("paused" in interrupted && interrupted.paused, true);
  assert.equal(paused, true);
  assert.equal(storedCursor, "cursor-1");

  const resumed = await runPagedShopifySync(createWorker(true));
  assert.equal(resumed.status, "completed");
  assert.deepEqual(fetchedCursors, [null, "cursor-1"]);
});

test("marks a claimed run failed when a page throws", async () => {
  let failure: string | null = null;
  const worker: ShopifySyncWorker<string> = {
    async claim() {
      return {
        acquired: true,
        runId: "run-1",
        status: "running",
        cursor: null,
        processedCount: 0,
        pagesProcessed: 0,
        leaseToken: "lease-1",
      };
    },
    async fetchPage() {
      throw new Error("Shopify unavailable");
    },
    async applyPage() {
      assert.fail("failed page must not be applied");
    },
    async complete() {
      assert.fail("failed sync must not complete");
    },
    async pause() {
      assert.fail("failed sync must not pause");
    },
    async fail({ error }) {
      failure = error;
    },
  };

  await assert.rejects(() => runPagedShopifySync(worker), /Shopify unavailable/);
  assert.equal(failure, "Shopify unavailable");
});

test("does not start work when another worker owns the run", async () => {
  const worker: ShopifySyncWorker<string> = {
    async claim() {
      return {
        acquired: false,
        runId: "run-1",
        status: "running",
        cursor: "cursor-1",
        processedCount: 100,
        pagesProcessed: 1,
        leaseExpiresAt: "2026-07-21T12:00:00Z",
      };
    },
    async fetchPage() {
      assert.fail("locked worker must not fetch Shopify");
    },
    async applyPage() {
      assert.fail("locked worker must not update the database");
    },
    async complete() {
      assert.fail("locked worker must not complete");
    },
    async pause() {
      assert.fail("locked worker must not pause the owner");
    },
    async fail() {
      assert.fail("locked worker must not fail the owner");
    },
  };

  const result = await runPagedShopifySync(worker);
  assert.deepEqual(result, {
    runId: "run-1",
    status: "running",
    acquired: false,
    cursor: "cursor-1",
    processedCount: 100,
    pagesProcessed: 1,
    leaseExpiresAt: "2026-07-21T12:00:00Z",
  });
});
