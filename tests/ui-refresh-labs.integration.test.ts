import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function readProjectFile(file: string) {
  return readFileSync(join(root, file), "utf8");
}

test("Labs uses the generic shell without duplicate navigation", () => {
  const labs = readProjectFile("app/labs/page.tsx");
  const config = readProjectFile("app/components/shell/route-config.ts");

  assert.match(config, /ADMIN_NAVIGATION_ITEMS/);
  assert.match(
    config,
    /id: "labs",[\s\S]+?moduleNavigation: undefined,[\s\S]+?width: "wide"/,
  );
  assert.doesNotMatch(labs, /SnakeNav|SnakeFooter|ModuleNav/);
});

test("Labs remains restricted to active administrators", () => {
  const labs = readProjectFile("app/labs/page.tsx");
  const roleGate = readProjectFile("app/components/auth/RoleGate.tsx");

  assert.match(labs, /allowedRoles=\{\["admin"\]\}/);
  assert.match(labs, /withinAppShell/);
  assert.match(roleGate, /supabase\.auth\.getUser\(\)/);
  assert.match(roleGate, /profile\?\.active/);
  assert.match(roleGate, /allowedRoles\.includes\(profile\.role\)/);
});

test("Labs keeps its existing tools and disabled-state behavior", () => {
  const labs = readProjectFile("app/labs/page.tsx");

  assert.match(labs, /href: "\/arne"/);
  assert.doesNotMatch(labs, /href: "\/borre\/pro"/);
  assert.match(labs, /title: "Arnes kontor"/);
  assert.match(labs, /title: "Shopify Control"/);
  assert.match(labs, /module\.status === "Aktiv"/);
  assert.match(labs, /href=\{isActive \? module\.href : "#"\}/);
  assert.match(labs, /Kommer senere/);
});

test("the legacy Arne office route permanently redirects to /arne", () => {
  const legacyRoute = readProjectFile("app/borre/pro/page.tsx");

  assert.match(
    legacyRoute,
    /import \{ permanentRedirect \} from "next\/navigation"/,
  );
  assert.match(legacyRoute, /permanentRedirect\("\/arne"\)/);
});
