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

const arneDefinition = {
  id: "arne",
  displayName: "Arne",
  role: "Snake-ekspert og admins rådgiver for Snake OS",
  capabilityIds: ["snake.assess_development"],
  model: { id: "gpt-5-mini" },
  getSystemPrompt: () => "unchanged Arne test prompt",
} as const satisfies EmployeeDefinition;

function request(userRole: string, employeeId = "borre", capabilityId = "warehouse.read_summary") {
  return {
    userId: "user-1",
    userRole,
    employeeId,
    capabilityId,
  };
}

test("all operative roles and legacy lager can use Borre", () => {
  for (const role of ["admin", "user", "warehouse", "lager"]) {
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

test("only admin policy allows Arne development assessment", () => {
  assert.deepEqual(
    evaluateWorkforceAuthorization(
      request("admin", "arne", "snake.assess_development"),
      arneDefinition
    ),
    {
      allowed: true,
      userId: "user-1",
      userRole: "admin",
      employeeId: "arne",
      capabilityId: "snake.assess_development",
    }
  );
  assert.deepEqual(
    evaluateWorkforceAuthorization(
      request("user", "arne", "snake.assess_development"),
      arneDefinition
    ),
    { allowed: false, reason: "policy_denied" }
  );

  for (const role of ["warehouse", "lager"]) {
    assert.deepEqual(
      evaluateWorkforceAuthorization(
        request(role, "arne", "snake.assess_development"),
        arneDefinition,
      ),
      { allowed: false, reason: "policy_denied" },
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
