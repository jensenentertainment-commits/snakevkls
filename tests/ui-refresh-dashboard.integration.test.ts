import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function readProjectFile(file: string) {
  return readFileSync(join(root, file), "utf8");
}

test("Dashboard uses the generic shell without a module navbar", () => {
  const dashboard = readProjectFile("app/dashboard/page.tsx");
  const config = readProjectFile("app/components/shell/route-config.ts");

  assert.match(config, /id: "dashboard"/);
  assert.match(config, /moduleNavigation: undefined/);
  assert.doesNotMatch(dashboard, /SnakeNav|SnakeFooter|ModuleNav/);
});

test("Dashboard exposes only the approved module set", () => {
  const dashboard = readProjectFile("app/dashboard/page.tsx");

  for (const title of [
    "Lager",
    "Lagersalg",
    "Viper",
    "Snake Labs",
    "Innstillinger",
  ]) {
    assert.match(dashboard, new RegExp(`title: "${title}"`));
  }

  assert.doesNotMatch(dashboard, /title: "Ordre"/);
  assert.doesNotMatch(dashboard, /Snake Brief/);
  assert.doesNotMatch(
    dashboard,
    new RegExp(["B", "ø", "r", "r", "e"].join(""), "i"),
  );
  assert.doesNotMatch(dashboard, /\bArne\b|\bRoy\b/);
});

test("Lagersalg is visible, enabled and links to the safe UI workspace", () => {
  const dashboard = readProjectFile("app/dashboard/page.tsx");
  const lagersalgBlock = dashboard.match(
    /\{\s*description: "Rask[\s\S]+?title: "Lagersalg",\s*\},/,
  );

  assert.ok(lagersalgBlock);
  assert.match(lagersalgBlock[0], /enabled: true/);
  assert.match(lagersalgBlock[0], /href: "\/warehouse-sales"/);
  assert.match(dashboard, /label="Kommer snart"/);
  assert.match(dashboard, /aria-disabled="true"/);
});

test("Dashboard preserves authentication and role filtering", () => {
  const dashboard = readProjectFile("app/dashboard/page.tsx");

  assert.match(dashboard, /createClient\(\)/);
  assert.match(dashboard, /supabase\.auth\.getUser\(\)/);
  assert.match(dashboard, /profile\?\.active/);
  assert.match(dashboard, /isRole\(profile\.role\)/);
  assert.match(dashboard, /module\.roles\.includes\(role\)/);
  assert.match(dashboard, /redirect\("\/login/);
});

test("Dashboard content uses canonical tokens and frozen primitives", () => {
  const dashboard = readProjectFile("app/dashboard/page.tsx");

  assert.match(dashboard, /import \{ Card, StatusBadge \}/);
  assert.doesNotMatch(dashboard, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  assert.doesNotMatch(
    dashboard,
    /\b(?:bg|text|border|ring)-(?:white|black|neutral|slate|gray|red|green|emerald|amber|blue|violet)(?:[-/[\s"'`]|$)/,
  );
  assert.doesNotMatch(dashboard, /rounded-(?:xl|2xl|3xl)|rounded-\[/);
});
