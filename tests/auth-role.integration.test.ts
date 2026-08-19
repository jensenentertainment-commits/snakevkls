import assert from "node:assert/strict";
import test from "node:test";
import { getAccessDecision, isRole } from "../lib/auth/roles.ts";

test("authentication rejects missing users", () => {
  assert.equal(
    getAccessDecision({
      authenticated: false,
      profile: { role: "admin", active: true },
      allowedRoles: ["admin"],
    }),
    "unauthenticated"
  );
});

test("role control rejects missing, inactive, and invalid profiles", () => {
  for (const profile of [
    null,
    { role: "admin", active: false },
    { role: "viewer", active: true },
    { role: null, active: true },
  ]) {
    assert.equal(
      getAccessDecision({
        authenticated: true,
        profile,
        allowedRoles: ["admin", "user", "warehouse", "lager"],
      }),
      "forbidden"
    );
  }

  assert.equal(isRole("viewer"), false);
});

test("role control permits only explicitly allowed active roles", () => {
  assert.equal(
    getAccessDecision({
      authenticated: true,
      profile: { role: "admin", active: true },
      allowedRoles: ["admin"],
    }),
    "allowed"
  );
  assert.equal(
    getAccessDecision({
      authenticated: true,
      profile: { role: "warehouse", active: true },
      allowedRoles: ["admin"],
    }),
    "forbidden"
  );
  assert.equal(
    getAccessDecision({
      authenticated: true,
      profile: { role: "user", active: true },
      allowedRoles: ["admin", "user"],
    }),
    "allowed"
  );

  assert.equal(isRole("admin"), true);
  assert.equal(isRole("user"), true);
  assert.equal(isRole("warehouse"), true);
  assert.equal(isRole("lager"), true);
});
