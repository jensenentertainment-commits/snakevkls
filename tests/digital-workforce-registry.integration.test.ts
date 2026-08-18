import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the employee registry contains only Borre and dormant Arne", async () => {
  const registry = await source("lib/intelligence/workforce/registry.ts");

  assert.match(registry, /import "server-only"/);
  assert.match(registry, /borre:\s*borreDefinition/);
  assert.match(registry, /arne:\s*arneDefinition/);
  assert.match(registry, /Object\.hasOwn\(employeeRegistry, employeeId\)/);
  assert.match(registry, /return null/);
  assert.doesNotMatch(registry, /\broy\b|\bpeder\b|\bpernille\b/i);
});

test("Arne declares the active prompt, model, and one read capability", async () => {
  const [employee, capability] = await Promise.all([
    source("lib/intelligence/workforce/employees/arne.ts"),
    source(
      "lib/intelligence/workforce/capabilities/snake-assess-development.ts"
    ),
  ]);

  assert.match(employee, /id:\s*"arne"/);
  assert.match(employee, /getSystemPrompt:\s*getArneSystemPrompt/);
  assert.match(employee, /id:\s*CHAT_MODEL/);
  assert.match(
    employee,
    /capabilityIds:\s*\[snakeAssessDevelopmentCapability\.id\]/
  );
  assert.match(capability, /id:\s*"snake\.assess_development"/);
  assert.match(capability, /effect:\s*"read"/);
  for (const sourceId of [
    "snake.knowledge",
    "snake.development_context",
    "warehouse.dashboard_stats",
    "warehouse.missing_location_products",
    "snake.latest_activity",
  ]) {
    assert.match(capability, new RegExp(`"${sourceId.replace(".", "\\.")}"`));
  }
  assert.doesNotMatch(
    capability,
    /\bexecute\b|\bwrite\b|\btool\b|\bhandoff\b|\bmemory\b/i
  );
});

test("Borre declares the existing prompt, model policy, and one capability", async () => {
  const employee = await source(
    "lib/intelligence/workforce/employees/borre.ts"
  );

  assert.match(employee, /id:\s*"borre"/);
  assert.match(employee, /getSystemPrompt:\s*getBorreChatSystemPrompt/);
  assert.match(employee, /id:\s*CHAT_MODEL/);
  assert.match(employee, /capabilityIds:\s*\[warehouseReadSummaryCapability\.id\]/);
});

test("the first capability is closed and read-only", async () => {
  const capability = await source(
    "lib/intelligence/workforce/capabilities/warehouse-read-summary.ts"
  );

  assert.match(capability, /id:\s*"warehouse\.read_summary"/);
  assert.match(capability, /effect:\s*"read"/);
  assert.match(capability, /"snake\.knowledge"/);
  assert.match(capability, /"warehouse\.dashboard_stats"/);
  assert.match(capability, /"warehouse\.missing_location_products"/);
  assert.doesNotMatch(
    capability,
    /\bexecute\b|\bwrite\b|\btool\b|\bhandoff\b|\bmemory\b/i
  );
});

test("only Borre's active route imports the workforce runtime", async () => {
  const [borreRoute, arneRoute] = await Promise.all([
    source("app/api/borre/ask/route.ts"),
    source("app/api/arne/ask/route.ts"),
  ]);

  assert.match(
    borreRoute,
    /intelligence\/workforce\/runtime/
  );
  assert.doesNotMatch(arneRoute, /intelligence\/workforce/);
});
