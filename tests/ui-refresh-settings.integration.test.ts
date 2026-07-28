import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function readProjectFile(file: string) {
  return readFileSync(join(root, file), "utf8");
}

test("Settings uses the generic shell without module navigation", () => {
  const settings = readProjectFile("app/settings/page.tsx");
  const config = readProjectFile("app/components/shell/route-config.ts");

  assert.match(config, /ADMIN_NAVIGATION_ITEMS/);
  assert.match(config, /id: "settings"/);
  assert.match(
    config,
    /id: "settings",[\s\S]+?moduleNavigation: undefined,[\s\S]+?width: "wide"/,
  );
  assert.doesNotMatch(settings, /SnakeNav|SnakeFooter|ModuleNav/);
});

test("Settings keeps admin access control inside AppShell", () => {
  const settings = readProjectFile("app/settings/page.tsx");
  const roleGate = readProjectFile("app/components/auth/RoleGate.tsx");

  assert.match(settings, /allowedRoles=\{\["admin"\]\}/);
  assert.match(settings, /withinAppShell/);
  assert.match(roleGate, /withinAppShell\?: boolean/);
  assert.match(roleGate, /supabase\.auth\.getUser\(\)/);
  assert.match(roleGate, /profiles/);
  assert.match(roleGate, /allowedRoles\.includes\(profile\.role\)/);
});

test("Settings preserves zone and user management behavior", () => {
  const settings = readProjectFile("app/settings/page.tsx");

  assert.match(settings, /\.from\("zones"\)\.insert/);
  assert.match(settings, /\.from\("zones"\)[\s\S]+?\.update/);
  assert.match(settings, /fetch\("\/api\/admin\/users"/);
  assert.match(settings, /fetch\("\/api\/admin\/users\/create"/);
  assert.match(settings, /fetch\("\/api\/admin\/users\/update-profile"/);
  assert.match(settings, /setShowCreateModal\(true\)/);
  assert.match(settings, /setShowCreateUserModal\(true\)/);
});
