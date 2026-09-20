import assert from "node:assert/strict";
import test from "node:test";
import {
  runPagedShopifySync, ShopifySyncRecoveryRequiredError, ShopifySyncWriteRejectedError,
  type ShopifySyncWorker, type ShopifySyncStoredRun,
} from "./sync-engine.ts";

function scenario(initialPages = 0, initialNext = true) {
  let state = {
    runId: "run-1", status: "running" as const, cursor: initialPages ? "previous" : null,
    pagesProcessed: initialPages, hasNextPage: initialNext, processedCount: initialPages,
    skippedNoSku: 0, collectionsLinked: 0, leaseExpiresAt: "2026-09-17T12:00:00Z",
  };
  const events: string[] = [];
  let persisted: ShopifySyncStoredRun | null = null;
  const worker: ShopifySyncWorker<string> = {
    async claim() { return { ...state, acquired: true, resumed: initialPages > 0, leaseToken: "lease" }; },
    async readRun(id) { assert.equal(id, "run-1"); events.push("read"); return persisted ?? state; },
    async fetchPage(cursor) {
      events.push(`fetch:${cursor}`);
      return { variants: ["variant"], endCursor: "final", hasNextPage: false };
    },
    async applyPage({ expectedCursor, expectedPagesProcessed, page }) {
      events.push("apply");
      assert.equal(expectedCursor, state.cursor);
      assert.equal(expectedPagesProcessed, state.pagesProcessed);
      state = { ...state, cursor: page.endCursor, hasNextPage: page.hasNextPage, pagesProcessed: state.pagesProcessed + 1 };
      return state;
    },
    async complete() {
      events.push("complete");
      assert.equal(state.hasNextPage, false);
      const completed = {
        runId: state.runId, status: "completed" as const, startedAt: "2026-09-17T11:00:00Z",
        completedAt: "2026-09-17T11:01:00Z", pagesProcessed: state.pagesProcessed, processedCount: state.processedCount,
        skippedNoSku: 0, collectionsLinked: 0, reconciledCount: 0,
      };
      persisted = completed;
      return completed;
    },
    async pause() { events.push("pause"); },
    async fail() { events.push("fail"); },
  };
  return { worker, events };
}

test("a reclaimed final page completes without fetching, replaying or fabricating old observations", async () => {
  const { worker, events } = scenario(12, false);
  const result = await runPagedShopifySync(worker);
  assert.equal(result.status, "completed");
  assert.equal(result.pagesProcessed, 12);
  assert.deepEqual(events, ["complete"]);
});

test("protected completion hold pauses a reclaimed final page without fetching or reconciling",async()=>{
  const {worker,events}=scenario(12,false);
  assert.equal((await runPagedShopifySync(worker,{deferCompletion:true})).status,"completion_hold");
  assert.deepEqual(events,["pause"]);
});

test("protected final-page pause failure does not invoke completion",async()=>{
  const {worker,events}=scenario(12,false);
  worker.pause=async()=>{events.push("pause");throw new Error("pause transport");};
  await assert.rejects(runPagedShopifySync(worker,{deferCompletion:true}));
  assert.ok(!events.includes("complete"));
});

test("a lost final-page acknowledgement uses stored state; reclaim only completes the run", async () => {
  const { worker, events } = scenario(4);
  const apply = worker.applyPage;
  worker.applyPage = async (input) => { await apply(input); throw new Error("transport lost after commit"); };
  await assert.rejects(runPagedShopifySync(worker), ShopifySyncRecoveryRequiredError);
  assert.deepEqual(events, ["fetch:previous", "apply", "read"]);
  assert.equal((await runPagedShopifySync(worker)).status, "completed");
  assert.deepEqual(events, ["fetch:previous", "apply", "read", "complete"]);
});

test("unchanged state after transport failure does not prove rollback of an in-flight transaction", async () => {
  const { worker, events } = scenario(4);
  const apply = worker.applyPage;
  worker.applyPage = async () => { throw new Error("connection dropped"); };
  await assert.rejects(runPagedShopifySync(worker), ShopifySyncRecoveryRequiredError);
  assert.deepEqual(events, ["fetch:previous", "read"]);
  worker.applyPage = apply;
  assert.equal((await runPagedShopifySync(worker)).status, "completed");
  assert.equal(events.filter((event) => event === "apply").length, 1);
});

test("lost non-final acknowledgement resumes at the persisted next page and count", async () => {
  const { worker, events } = scenario();
  const fetch = worker.fetchPage;
  worker.fetchPage = async () => ({ variants: ["first"], endCursor: "next", hasNextPage: true });
  const apply = worker.applyPage;
  worker.applyPage = async (input) => { await apply(input); throw new Error("lost ack"); };
  await assert.rejects(runPagedShopifySync(worker), ShopifySyncRecoveryRequiredError);
  worker.applyPage = apply;
  worker.fetchPage = fetch;
  const result = await runPagedShopifySync(worker);
  assert.equal(result.pagesProcessed, 2);
  assert.deepEqual(events, ["apply", "read", "fetch:next", "apply", "complete"]);
});

test("a failed recovery read leaves the lease for later reclaim and never fails the run", async () => {
  const { worker, events } = scenario();
  worker.applyPage = async () => { throw new Error("transport"); };
  worker.readRun = async () => { events.push("read"); throw new Error("database unreachable"); };
  await assert.rejects(runPagedShopifySync(worker), /outcome is unresolved/);
  assert.deepEqual(events, ["fetch:null", "read"]);
});

test("explicit SQL rejection plus unchanged stored checkpoint safely marks failure", async () => {
  const { worker, events } = scenario();
  worker.applyPage = async () => { throw new ShopifySyncWriteRejectedError("constraint failure"); };
  await assert.rejects(runPagedShopifySync(worker), /constraint failure/);
  assert.deepEqual(events, ["fetch:null", "read", "fail"]);
});

test("SQL rejection with an advanced stored checkpoint cannot fail another worker", async () => {
  const { worker, events } = scenario();
  const apply = worker.applyPage;
  worker.applyPage = async (input) => { await apply(input); throw new ShopifySyncWriteRejectedError("stale replay"); };
  await assert.rejects(runPagedShopifySync(worker), ShopifySyncRecoveryRequiredError);
  assert.deepEqual(events, ["fetch:null", "apply", "read"]);
});

test("lost completion acknowledgement resolves to authoritative completed state", async () => {
  const { worker, events } = scenario(4, false);
  const complete = worker.complete;
  worker.complete = async (input) => { await complete(input); throw new Error("lost completion response"); };
  assert.equal((await runPagedShopifySync(worker)).status, "completed");
  assert.deepEqual(events, ["complete", "read"]);
});

test("malformed apply and completion acknowledgements require persisted-state recovery", async () => {
  for (const phase of ["apply", "complete"]) {
    const { worker, events } = scenario(4, phase === "apply");
    if (phase === "apply") worker.applyPage = async () => ({}) as Awaited<ReturnType<typeof worker.applyPage>>;
    else worker.complete = async () => ({}) as Awaited<ReturnType<typeof worker.complete>>;
    await assert.rejects(runPagedShopifySync(worker), ShopifySyncRecoveryRequiredError);
    assert.ok(events.includes("read"));
    assert.ok(!events.includes("fail"));
  }
});

test("missing persisted hasNextPage fails closed rather than guessing how to resume", async () => {
  const { worker, events } = scenario(4);
  const claim = worker.claim;
  worker.claim = async () => ({ ...await claim(), hasNextPage: undefined }) as unknown as Awaited<ReturnType<typeof worker.claim>>;
  await assert.rejects(runPagedShopifySync(worker), /persisted pagination state/);
  assert.deepEqual(events, ["fail"]);
});
