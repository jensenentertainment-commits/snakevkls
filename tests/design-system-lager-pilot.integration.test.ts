import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const lagerPages = [
  "app/lager/page.tsx",
  "app/products/page.tsx",
  "app/products/[id]/page.tsx",
  "app/locations/page.tsx",
  "app/locations/[code]/page.tsx",
  "app/locations/labels/page.tsx",
  "app/fix-locations/page.tsx",
  "app/issues/page.tsx",
  "app/location-count/page.tsx",
  "app/activities/page.tsx",
] as const;

function readProjectFile(file: string) {
  return readFileSync(join(root, file), "utf8");
}

test("all Lager pilot routes have removed legacy navigation", () => {
  for (const page of lagerPages) {
    const source = readProjectFile(page);

    assert.doesNotMatch(source, /SnakeNav/, `${page} keeps legacy navigation`);
    assert.doesNotMatch(source, /SnakeFooter/, `${page} keeps the global footer`);
  }
});

test("the Lager shell composes only the frozen layout contracts", () => {
  const shell = readProjectFile(
    "app/components/lager/LagerAppShell.tsx",
  );
  const routeShell = readProjectFile(
    "app/components/lager/LagerRouteShell.tsx",
  );
  const rootLayout = readProjectFile("app/layout.tsx");

  assert.match(shell, /<AppShell/);
  assert.match(shell, /<AppNavbar/);
  assert.match(shell, /<ModuleNav navigation=\{LAGER_MODULE_NAVIGATION\}/);
  assert.match(shell, /width="wide"/);
  assert.match(routeShell, /isNavigationItemActive/);
  assert.match(routeShell, /<LagerAppShell>\{children\}<\/LagerAppShell>/);
  assert.match(rootLayout, /<LagerRouteShell>\{children\}<\/LagerRouteShell>/);
  assert.doesNotMatch(shell, /SnakeNav|SnakeFooter|Viper/);
  assert.doesNotMatch(
    shell,
    new RegExp(["D", "i", "g", "i", "t", "a", "l", "\\s+", "W"].join(""), "i"),
  );
});

test("date and time live in the global navbar, not Lager page content", () => {
  const navbar = readProjectFile(
    "app/components/layout/AppNavbar.tsx",
  );
  const footer = readProjectFile("app/components/SnakeFooter.tsx");

  assert.match(navbar, /<AppClock/);
  assert.match(footer, /toLocaleString/);

  for (const page of lagerPages) {
    assert.doesNotMatch(readProjectFile(page), /<AppClock|<SnakeFooter/);
  }
});

test("the navigation classification preserves view and action boundaries", () => {
  const classification = readProjectFile(
    "docs/snake-design-system-v1-lager-navigation-classification.md",
  );

  for (const heading of [
    "Global navigasjon",
    "Lokal modulnavigasjon",
    "Tabs for visninger",
    "Toolbar for handlinger og filtre",
    "Innhold som ikke er navigasjon",
  ]) {
    assert.match(classification, new RegExp(`## ${heading}`));
  }

  assert.match(classification, /Tabs endrer visningen av samme datasett/);
  assert.match(
    classification,
    /Toolbars inneholder bare handlinger eller filtre/,
  );
});

test("the Lager shell uses canonical tokens without hardcoded colors", () => {
  const sources = [
    "app/components/lager/LagerAppShell.tsx",
    "app/components/lager/LagerLogoutButton.tsx",
  ]
    .map(readProjectFile)
    .join("\n");

  assert.doesNotMatch(sources, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  assert.doesNotMatch(
    sources,
    /--(?:background|foreground|vk-|snake-bg|snake-panel|snake-hero)/,
  );
});
