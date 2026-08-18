import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { WorkforceRunMetadata } from "../lib/intelligence/workforce/workforce-run-metadata.ts";
import { executeReadOnlyWorkforceRequest } from "../lib/intelligence/workforce/read-only-execution.ts";
import { createWarehouseSummaryContext } from "../lib/intelligence/workforce/contexts/warehouse-summary.ts";

const employee = {
  id: "borre",
  displayName: "Børre",
  role: "Lagerassistent i Snake OS",
  capabilityIds: ["warehouse.read_summary"],
  model: { id: "gpt-5-mini" },
  getSystemPrompt: () => "System prompt fixture",
} as const;
const capability = {
  id: "warehouse.read_summary",
  effect: "read",
  dataSourceIds: [
    "snake.knowledge",
    "warehouse.dashboard_stats",
    "warehouse.missing_location_products",
  ],
} as const;
const warehouseContext = createWarehouseSummaryContext({
  snakeKnowledge: "Knowledge fixture",
  page: "/lager",
  stats: {
    activeProductCount: 1,
    placedProductCount: 1,
    quantityDiffCount: 0,
    missingLocationCount: 0,
    missingSkuCount: 0,
    locationsNoZoneCount: 0,
    emptyLocationCount: 0,
    latestShopifySync: null,
  },
  missingInventoryRows: [],
  products: [],
});
const request = {
  employeeId: "borre" as const,
  capabilityId: "warehouse.read_summary" as const,
  input: {
    question: "Hva er status?",
    page: "/lager",
    history: [{ role: "user" as const, text: "Tidligere spørsmål" }],
  },
};
const principal = { userId: "user-1", userRole: "admin" } as const;
const allowed = {
  allowed: true,
  userId: "user-1",
  userRole: "admin",
  employeeId: "borre",
  capabilityId: "warehouse.read_summary",
} as const;

function createDependencies(events: string[], runs: WorkforceRunMetadata[]) {
  let currentTime = Date.parse("2026-08-18T10:00:00.000Z");

  return {
    employee,
    capability,
    provider: {
      id: "warehouse.summary" as const,
      capabilityId: "warehouse.read_summary" as const,
      async provide() {
        events.push("provider");
        currentTime += 5;
        return warehouseContext;
      },
    },
    async createModelResponse() {
      events.push("model");
      currentTime += 7;
      return "Modellsvar";
    },
    logRun(metadata: WorkforceRunMetadata) {
      events.push("log");
      runs.push(metadata);
    },
    now() {
      return currentTime;
    },
  };
}

test("a denied authorization never reaches provider or model", async () => {
  const events: string[] = [];
  const runs: WorkforceRunMetadata[] = [];
  const result = await executeReadOnlyWorkforceRequest({
    runId: "run-denied",
    request,
    principal,
    authorization: { allowed: false, reason: "policy_denied" },
    dependencies: createDependencies(events, runs),
  });

  assert.deepEqual(result, {
    ok: false,
    runId: "run-denied",
    outcome: "denied",
  });
  assert.deepEqual(events, ["log"]);
  assert.equal(runs[0].outcome, "denied");
  assert.equal(runs[0].userId, "user-1");
  assert.equal(runs[0].userRole, "admin");
});

test("an unknown role is denied and recorded without inventing a role", async () => {
  const events: string[] = [];
  const runs: WorkforceRunMetadata[] = [];
  await executeReadOnlyWorkforceRequest({
    runId: "run-unknown-role",
    request,
    principal: { userId: "user-2", userRole: "owner" },
    authorization: { allowed: false, reason: "policy_denied" },
    dependencies: createDependencies(events, runs),
  });

  assert.deepEqual(events, ["log"]);
  assert.equal(runs[0].userId, "user-2");
  assert.equal(runs[0].userRole, "unknown");
});

test("an allowed run executes provider before model and logs completion", async () => {
  const events: string[] = [];
  const runs: WorkforceRunMetadata[] = [];
  const result = await executeReadOnlyWorkforceRequest({
    runId: "run-completed",
    request,
    principal,
    authorization: allowed,
    dependencies: createDependencies(events, runs),
  });

  assert.deepEqual(result, {
    ok: true,
    runId: "run-completed",
    answer: "Modellsvar",
  });
  assert.deepEqual(events, ["provider", "model", "log"]);
  assert.equal(runs[0].outcome, "completed");
  assert.equal(runs[0].contextDurationMs, 5);
  assert.equal(runs[0].modelDurationMs, 7);
});

test("run metadata excludes conversation, prompt, context, and response", async () => {
  const events: string[] = [];
  const runs: WorkforceRunMetadata[] = [];
  await executeReadOnlyWorkforceRequest({
    runId: "run-metadata",
    request,
    principal,
    authorization: allowed,
    dependencies: createDependencies(events, runs),
  });

  const serialized = JSON.stringify(runs[0]);
  for (const sensitiveValue of [
    "Hva er status?",
    "Tidligere spørsmål",
    "System prompt fixture",
    "Knowledge fixture",
    "Modellsvar",
  ]) {
    assert.equal(serialized.includes(sensitiveValue), false);
  }
});

test("provider and model failures remain separate read-only outcomes", async () => {
  const providerEvents: string[] = [];
  const providerRuns: WorkforceRunMetadata[] = [];
  const providerDependencies = createDependencies(providerEvents, providerRuns);
  providerDependencies.provider.provide = async () => {
    providerEvents.push("provider");
    throw new Error("context failed");
  };

  const providerResult = await executeReadOnlyWorkforceRequest({
    runId: "run-context-failed",
    request,
    principal,
    authorization: allowed,
    dependencies: providerDependencies,
  });
  assert.equal(providerResult.ok, false);
  assert.deepEqual(providerEvents, ["provider", "log"]);
  assert.equal(providerRuns[0].outcome, "context_failed");

  const modelEvents: string[] = [];
  const modelRuns: WorkforceRunMetadata[] = [];
  const modelDependencies = createDependencies(modelEvents, modelRuns);
  modelDependencies.createModelResponse = async () => {
    modelEvents.push("model");
    throw new Error("model failed");
  };
  const modelResult = await executeReadOnlyWorkforceRequest({
    runId: "run-model-failed",
    request,
    principal,
    authorization: allowed,
    dependencies: modelDependencies,
  });
  assert.equal(modelResult.ok, false);
  assert.deepEqual(modelEvents, ["provider", "model", "log"]);
  assert.equal(modelRuns[0].outcome, "model_failed");
});

test("server runtime authorizes before execution and defines no tools or routing", async () => {
  const runtime = await readFile(
    new URL("../lib/intelligence/workforce/runtime.ts", import.meta.url),
    "utf8"
  );
  const authorizationIndex = runtime.indexOf("authorizeWorkforceRequest({");
  const executionIndex = runtime.indexOf("executeReadOnlyWorkforceRequest({");

  assert.match(runtime, /import "server-only"/);
  assert.ok(authorizationIndex >= 0);
  assert.ok(executionIndex > authorizationIndex);
  assert.doesNotMatch(
    runtime,
    /\btools\s*:|\btool_choice\s*:|\bfunction_call\s*:|\bhandoff\b|\brouteEmployee\b/i
  );
});
