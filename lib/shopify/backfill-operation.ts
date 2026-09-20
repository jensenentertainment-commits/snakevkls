import { createHash } from "node:crypto";
import { createCatalogRequest, fetchShopifyCatalogPage } from "./catalog-source.ts";
import { prepareShopifyPersistencePage, parseStoredSyncRun, syncWriteResult } from "./sync-persistence.ts";
import { runPagedShopifySync, type ShopifySyncClaim, type ShopifySyncProgress, type ShopifySyncWorker } from "./sync-engine.ts";
import type { ShopifyVariantPayload } from "./catalog-sync.ts";

export const BACKFILL_VERSION = "phase2a_backfill_v1";
export type BackfillTarget = {
  projectRef: string; supabaseUrl: string; shop: string; locationId: string;
  codeRevision: string; contractVersion: typeof BACKFILL_VERSION;
  runtimeGateDisabled: true;
};
export type BackfillRpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid operator response");
  return value as Record<string, unknown>;
}
export function parseBackfillTarget(value: unknown): BackfillTarget {
  const t = record(value);
  const keys = ["projectRef", "supabaseUrl", "shop", "locationId", "codeRevision", "contractVersion", "runtimeGateDisabled"];
  if (Object.keys(t).length !== keys.length || !keys.every(k => Object.hasOwn(t,k))
    || !/^[a-z0-9]{20}$/.test(String(t.projectRef)) || t.supabaseUrl !== `https://${t.projectRef}.supabase.co`
    || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(String(t.shop))
    || !/^gid:\/\/shopify\/Location\/\d+$/.test(String(t.locationId))
    || !/^[a-f0-9]{40}$/.test(String(t.codeRevision)) || t.contractVersion !== BACKFILL_VERSION
    || t.runtimeGateDisabled !== true) throw new Error("Invalid explicit target / gate attestation");
  return t as BackfillTarget;
}
export function assertUuid(value: string): void {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new Error("Explicit UUID required");
}
export function approval(command: "start" | "resume" | "complete", target: BackfillTarget, operation: string, run?: string, digest?: string) {
  assertUuid(operation);
  if (command !== "start") assertUuid(run ?? "");
  if (command === "complete" && !/^[a-f0-9]{64}$/.test(digest ?? "")) throw new Error("Reconciliation digest required");
  return command === "start" ? `START ${operation} ${target.projectRef} ${target.shop}`
    : command === "resume" ? `RESUME ${operation} ${run}` : `COMPLETE ${operation} ${run} ${digest}`;
}
export function requireApproval(actual: string | undefined, expected: string) {
  if (actual !== expected) throw new Error(`Explicit confirmation required: ${expected}`);
}
export function assertReady(planValue: unknown, target: BackfillTarget, operation?: string, run?: string) {
  const plan = record(planValue);
  const functions = record(plan.functions);
  if (plan.schemaVersion !== 1 || plan.controlVersion !== BACKFILL_VERSION || plan.writerVersion !== "apply_shopify_sync_page_v2"
    || plan.shop !== target.shop || plan.locationId !== target.locationId || plan.connectionAvailable !== true || plan.proofAvailable !== true
    || !["get_roy_catalog_foundation_v1", "get_roy_targeted_product_v1", "apply_shopify_sync_page_v2", "start_shopify_backfill_v1"].every(k => /^[a-f0-9]{32}$/.test(String(functions[k])))) throw new Error("Preflight schema/store/location readiness failed");
  if (operation) {
    const bound = record(plan.operation);
    const identity = record(bound.identity);
    if (bound.operation_id !== operation || bound.run_id !== run || Object.keys(target).some(k => identity[k] !== target[k as keyof BackfillTarget])) throw new Error("Bound target/operation/run identity mismatch");
  } else if (plan.resumableRun !== null) throw new Error("Existing resumable run blocks admission");
}

type Traversal = { productId: string; pageCount: number; finalHasNextPage: boolean; membershipCount: number; observedAt: string; cursorDigest: string };
export async function runProtectedBackfill(input: {
  target: BackfillTarget; operation: string; run: string; confirmation: string;
  rpc: BackfillRpc; accessToken: string; maxPages: number; fetch?: typeof fetch;
}) {
  requireApproval(input.confirmation, approval("resume", input.target, input.operation, input.run));
  if (!Number.isInteger(input.maxPages) || input.maxPages < 1 || input.maxPages > 20) throw new Error("maxPages must be 1..20");
  let leaseDeadline = 0;
  let traversals = new Map<string, Traversal>();
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await input.rpc(name,args); return syncWriteResult<unknown>(r.data,r.error);
  };
  const worker: ShopifySyncWorker<ShopifyVariantPayload> = {
    async claim() {
      const c = record(await call("claim_shopify_backfill_v1", { requested_operation: input.operation, requested_run_id: input.run, confirmation: input.confirmation }));
      if (c.runId !== input.run || typeof c.acquired !== "boolean") throw new Error("Invalid bound claim acknowledgement");
      leaseDeadline = Date.parse(String(c.leaseExpiresAt));
      return c as ShopifySyncClaim;
    },
    async readRun(runId) { return parseStoredSyncRun(await call("recover_shopify_backfill_v1", { requested_operation: input.operation, requested_run_id: runId, confirmation: input.confirmation }), runId); },
    async fetchPage(cursor) {
      traversals = new Map();
      return fetchShopifyCatalogPage({ cursor, locationId: input.target.locationId,
        request: createCatalogRequest({ shop: input.target.shop, apiVersion: "2026-04", accessToken: input.accessToken,
          deadlineMs: Math.min(Date.now()+60_000,leaseDeadline-10_000), fetch: input.fetch }),
        onCollectionPage(productId, e) {
          const prior = traversals.get(productId);
          traversals.set(productId, { productId, pageCount: (prior?.pageCount ?? 0)+1,
            finalHasNextPage: e.hasNextPage, membershipCount: e.membershipCount, observedAt: e.observedAt,
            cursorDigest: createHash("sha256").update((prior?.cursorDigest ?? "")+JSON.stringify(e)).digest("hex") });
        },
      });
    },
    async applyPage({ runId, leaseToken, expectedCursor, expectedPagesProcessed, page }) {
      const payload = prepareShopifyPersistencePage(page.variants);
      const result = await call("apply_shopify_backfill_page_v1", { requested_operation: input.operation, requested_run_id: runId,
        requested_lease_token: leaseToken, expected_cursor: expectedCursor, expected_pages_processed: expectedPagesProcessed,
        next_cursor: page.endCursor, page_has_next: page.hasNextPage, page_variants: payload.variants, page_products: payload.products,
        traversal_evidence: [...traversals.values()].sort((a,b) => a.productId < b.productId ? -1 : 1) }) as ShopifySyncProgress;
      leaseDeadline=Date.parse(result.leaseExpiresAt); return result;
    },
    async complete() { throw new Error("Protected traversal cannot complete/reconcile; operator approval required"); },
    async pause({runId,leaseToken}) { await call("pause_shopify_backfill_v1", { requested_operation:input.operation,requested_run_id:runId,requested_lease_token:leaseToken }); },
    async fail({runId,leaseToken}) { await call("pause_shopify_backfill_v1", { requested_operation:input.operation,requested_run_id:runId,requested_lease_token:leaseToken }); },
  };
  return runPagedShopifySync(worker,{ maxPages:input.maxPages,softDurationMs:240_000,deferCompletion:true });
}
