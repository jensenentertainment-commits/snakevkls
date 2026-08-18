import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { EmployeeDefinition } from "../lib/intelligence/workforce/employee-definition.ts";
import { evaluateWorkforceAuthorization } from "../lib/intelligence/workforce/workforce-authorization.ts";

const borreDefinition = {
  id: "borre",
  displayName: "Børre",
  role: "Lagerassistent i Snake OS",
  capabilityIds: ["warehouse.read_summary"],
  model: { id: "gpt-5-mini" },
  getSystemPrompt: () => "unchanged test prompt",
} as const satisfies EmployeeDefinition;

function request(userRole: string, employeeId = "borre", capabilityId = "warehouse.read_summary") {
  return {
    userId: "user-1",
    userRole,
    employeeId,
    capabilityId,
  };
}

test("explicit admin and lager policy entries allow Borre read summary", () => {
  for (const role of ["admin", "lager"]) {
    assert.deepEqual(
      evaluateWorkforceAuthorization(request(role), borreDefinition),
      {
        allowed: true,
        userId: "user-1",
        userRole: role,
        employeeId: "borre",
        capabilityId: "warehouse.read_summary",
      }
    );
  }
});

test("an unknown employee fails closed", () => {
  assert.deepEqual(
    evaluateWorkforceAuthorization(request("admin", "roy"), null),
    { allowed: false, reason: "unknown_employee" }
  );
  assert.deepEqual(
    evaluateWorkforceAuthorization(request("admin", "roy"), borreDefinition),
    { allowed: false, reason: "unknown_employee" }
  );
});

test("a capability not declared by the employee fails closed", () => {
  assert.deepEqual(
    evaluateWorkforceAuthorization(
      request("admin", "borre", "warehouse.write"),
      borreDefinition
    ),
    { allowed: false, reason: "undeclared_capability" }
  );
});

test("an unknown human role fails closed", () => {
  assert.deepEqual(
    evaluateWorkforceAuthorization(request("viewer"), borreDefinition),
    { allowed: false, reason: "policy_denied" }
  );
});

test("the public authorization entry point resolves only registered employees", async () => {
  const source = await readFile(
    new URL(
      "../lib/intelligence/workforce/authorize-workforce-request.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(source, /import "server-only"/);
  assert.match(source, /getEmployeeDefinition\(request\.employeeId\)/);
  assert.match(source, /evaluateWorkforceAuthorization/);
});
