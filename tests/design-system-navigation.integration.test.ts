import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const layoutDirectory = join(root, "app", "components", "layout");
const navigationDirectory = join(root, "app", "components", "navigation");
const layoutFiles = [
  "AppClock.tsx",
  "AppNavbar.tsx",
  "AppNavLinks.tsx",
  "AppShell.tsx",
  "AppUserMenu.tsx",
  "MobileNav.tsx",
  "ModuleNav.tsx",
  "ModuleNavMobile.tsx",
] as const;

function readLayout(file: (typeof layoutFiles)[number]) {
  return readFileSync(join(layoutDirectory, file), "utf8");
}

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

test("Commit 3 exposes the approved generic layout and navigation API", () => {
  const layoutApi = readFileSync(join(layoutDirectory, "index.ts"), "utf8");
  const navigationApi = readFileSync(
    join(navigationDirectory, "index.ts"),
    "utf8",
  );

  for (const component of [
    "AppClock",
    "AppNavbar",
    "AppNavLinks",
    "AppShell",
    "AppUserMenu",
    "MobileNav",
    "ModuleNav",
    "ModuleNavMobile",
  ]) {
    assert.match(layoutApi, new RegExp(`export[\\s\\S]*\\b${component}\\b`));
  }

  for (const contract of [
    "GLOBAL_NAVIGATION_ITEMS",
    "ADMIN_NAVIGATION_ITEMS",
    "LAGER_MODULE_NAVIGATION",
    "ModuleNavigation",
    "NavigationItem",
  ]) {
    assert.match(
      navigationApi,
      new RegExp(`export[\\s\\S]*\\b${contract}\\b`),
    );
  }
});

test("global and module navigation remain separate concerns", () => {
  const modules = readFileSync(
    join(navigationDirectory, "modules.ts"),
    "utf8",
  );
  const globalBlock = modules.slice(
    modules.indexOf("GLOBAL_NAVIGATION_ITEMS"),
    modules.indexOf("ADMIN_NAVIGATION_ITEMS"),
  );
  const lagerBlock = modules.slice(modules.indexOf("LAGER_MODULE_NAVIGATION"));

  for (const label of ["Dashboard", "Lager", "Viper"]) {
    assert.match(globalBlock, new RegExp(`label: "${label}"`));
  }

  for (const label of [
    "Oversikt",
    "Produkter",
    "Lokasjoner",
    "Ryddemodus",
    "Avvik",
    "Telling",
    "Aktivitet",
  ]) {
    assert.match(lagerBlock, new RegExp(`label: "${label}"`));
    assert.doesNotMatch(globalBlock, new RegExp(`label: "${label}"`));
  }

  assert.doesNotMatch(globalBlock, /Innstillinger|Labs/);
  assert.match(modules, /ADMIN_NAVIGATION_ITEMS/);
});

test("layout code uses canonical tokens and excludes workforce concerns", () => {
  const sources = [
    ...layoutFiles.map(readLayout),
    readFileSync(join(navigationDirectory, "modules.ts"), "utf8"),
    readFileSync(join(navigationDirectory, "types.ts"), "utf8"),
  ].join("\n");
  const legacyToken =
    /--(?:background|foreground|vk-|snake-bg|snake-panel|snake-hero|snake-card-radius|snake-panel-radius|snake-control-radius)/;
  const hardcodedColor = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;
  const directPaletteUtility =
    /(?:bg|text|border|ring)-(?:white|black|neutral|slate|gray|zinc|stone|red|green|emerald|amber|blue|violet)(?:[-/"])/;

  assert.doesNotMatch(sources, legacyToken);
  assert.doesNotMatch(sources, hardcodedColor);
  assert.doesNotMatch(sources, directPaletteUtility);
  assert.doesNotMatch(
    sources,
    new RegExp(["B", "o", "r", "r", "e"].join(""), "i"),
  );
  assert.doesNotMatch(
    sources,
    new RegExp(["D", "i", "g", "i", "t", "a", "l", "\\s+", "W"].join(""), "i"),
  );
});

test("only route-aware and time-aware islands are client components", () => {
  assert.match(readLayout("AppClock.tsx"), /^"use client";/);
  assert.match(readLayout("AppNavLinks.tsx"), /^"use client";/);
  assert.match(readLayout("MobileNav.tsx"), /^"use client";/);
  assert.match(readLayout("ModuleNavMobile.tsx"), /^"use client";/);

  for (const file of layoutFiles.filter(
    (file) =>
      ![
        "AppClock.tsx",
        "AppNavLinks.tsx",
        "MobileNav.tsx",
        "ModuleNavMobile.tsx",
      ].includes(file),
  )) {
    assert.doesNotMatch(readLayout(file), /^"use client";/, file);
  }
});

test("navigation accessibility and clock contracts are explicit", () => {
  const navbar = readLayout("AppNavbar.tsx");
  const mobile = readLayout("MobileNav.tsx");
  const moduleNav = readLayout("ModuleNav.tsx");
  const clock = readLayout("AppClock.tsx");

  assert.match(navbar, /aria-label="Systemnavigasjon"/);
  assert.match(mobile, /Åpne systemnavigasjon/);
  assert.match(mobile, /aria-label="Administrasjon"/);
  assert.match(moduleNav, /arbeidsnavigasjon/);
  assert.match(clock, /hour: "2-digit"/);
  assert.match(clock, /minute: "2-digit"/);
  assert.doesNotMatch(clock, /second:/);
  assert.doesNotMatch(clock, /aria-live/);
});

test("Commit 3 does not migrate pages or replace the existing navbar", () => {
  const pageSources = collectFiles(join(root, "app"))
    .filter((file) => file.endsWith("page.tsx"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.doesNotMatch(pageSources, /components\/layout/);
  assert.ok(!layoutFiles.includes("SnakeNav.tsx" as never));
  assert.ok(!layoutFiles.includes("SnakeFooter.tsx" as never));
});

test("all layout utility names are backed by the frozen token API", () => {
  const globals = readFileSync(join(root, "app", "globals.css"), "utf8");
  const sources = layoutFiles.map(readLayout).join("\n");
  const utilityTokens = new Set(
    [...sources.matchAll(/\b(?:bg|text|border|ring|shadow|rounded)-snake-[\w-]+/g)]
      .map(([utility]) => utility)
      .sort(),
  );

  assert.ok(utilityTokens.size > 0);

  for (const utility of utilityTokens) {
    const [namespace, ...nameParts] = utility.split("-");
    const name = nameParts.join("-");
    const themePrefix =
      namespace === "rounded"
        ? "--radius-"
        : namespace === "shadow"
          ? "--shadow-"
          : "--color-";

    assert.match(
      globals,
      new RegExp(`${themePrefix}${name}:`),
      `${utility} is not exposed by @theme inline`,
    );
  }
});
