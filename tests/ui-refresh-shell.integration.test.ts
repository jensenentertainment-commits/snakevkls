import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function readProjectFile(file: string) {
  return readFileSync(join(root, file), "utf8");
}

test("the UI Refresh shell is generic and route configured", () => {
  const routeShell = readProjectFile(
    "app/components/shell/AppRouteShell.tsx",
  );
  const authenticatedShell = readProjectFile(
    "app/components/shell/AuthenticatedAppShell.tsx",
  );
  const config = readProjectFile("app/components/shell/route-config.ts");

  assert.match(routeShell, /APP_ROUTE_SHELLS\.find/);
  assert.match(routeShell, /isNavigationItemActive/);
  assert.match(routeShell, /if \(!routeShell\) return children/);
  assert.match(authenticatedShell, /moduleNavigation\?/);
  assert.match(authenticatedShell, /width=\{width\}/);
  assert.match(config, /satisfies readonly AppRouteShellConfig\[\]/);
});

test("UI Refresh activates only migrated route shells", () => {
  const config = readProjectFile("app/components/shell/route-config.ts");

  assert.match(config, /id: "dashboard"/);
  assert.match(config, /id: "lager"/);
  assert.match(config, /LAGER_MODULE_NAVIGATION/);
  assert.doesNotMatch(config, /id: "viper"/);
  assert.doesNotMatch(config, /id: "labs"/);
  assert.doesNotMatch(config, /id: "settings"/);
});

test("the generic shell uses only canonical visual tokens", () => {
  const sources = [
    "app/components/shell/AppLogoutButton.tsx",
    "app/components/shell/AppRouteShell.tsx",
    "app/components/shell/AuthenticatedAppShell.tsx",
    "app/components/shell/route-config.ts",
  ]
    .map(readProjectFile)
    .join("\n");

  assert.doesNotMatch(sources, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  assert.doesNotMatch(
    sources,
    /\b(?:bg|text|border|ring)-(?:white|black|neutral|slate|gray|red|green|emerald|amber|blue|violet)(?:[-/[\s"'`]|$)/,
  );
  assert.doesNotMatch(sources, /SnakeNav|SnakeFooter/);
});

test("the public Lager shell remains available as a compatibility wrapper", () => {
  const lagerShell = readProjectFile(
    "app/components/lager/LagerAppShell.tsx",
  );
  const lagerRouteShell = readProjectFile(
    "app/components/lager/LagerRouteShell.tsx",
  );

  assert.match(lagerShell, /<AuthenticatedAppShell/);
  assert.match(lagerShell, /LAGER_MODULE_NAVIGATION/);
  assert.match(lagerRouteShell, /<AppRouteShell>/);
});
