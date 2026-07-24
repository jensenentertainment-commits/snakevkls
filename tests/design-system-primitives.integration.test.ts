import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const componentDirectory = join(root, "app", "components", "design-system");
const componentFiles = [
  "Badge.tsx",
  "Button.tsx",
  "Card.tsx",
  "IconButton.tsx",
  "Progress.tsx",
  "StatusBadge.tsx",
  "Surface.tsx",
] as const;

function readComponent(file: (typeof componentFiles)[number]) {
  return readFileSync(join(componentDirectory, file), "utf8");
}

test("Commit 2 exposes only the approved primitive set", () => {
  const publicApi = readFileSync(join(componentDirectory, "index.ts"), "utf8");

  for (const component of [
    "Badge",
    "Button",
    "Card",
    "IconButton",
    "Progress",
    "StatusBadge",
    "Surface",
  ]) {
    assert.match(publicApi, new RegExp(`export[\\s\\S]*\\b${component}\\b`));
  }

  assert.doesNotMatch(publicApi, /Navbar|Footer|Viper|Borre|Arne|Roy/);
});

test("primitives use canonical tokens without legacy or hardcoded colors", () => {
  const legacyToken =
    /--(?:background|foreground|vk-|snake-bg|snake-panel|snake-hero|snake-card-radius|snake-panel-radius|snake-control-radius)/;
  const hardcodedColor = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;
  const directPaletteUtility =
    /(?:bg|text|border|ring)-(?:white|black|neutral|slate|gray|zinc|stone|red|green|emerald|amber|blue|violet)(?:[-/"])/;

  for (const file of componentFiles) {
    const source = readComponent(file);

    assert.doesNotMatch(source, legacyToken, `${file} uses a compatibility alias`);
    assert.doesNotMatch(source, hardcodedColor, `${file} hardcodes a color`);
    assert.doesNotMatch(
      source,
      directPaletteUtility,
      `${file} bypasses the canonical color API`,
    );
    assert.doesNotMatch(
      source,
      /["']use client["']/,
      `${file} creates an unnecessary client boundary`,
    );
  }
});

test("interactive primitives include their accessibility contracts", () => {
  const button = readComponent("Button.tsx");
  const iconButton = readComponent("IconButton.tsx");
  const progress = readComponent("Progress.tsx");
  const statusBadge = readComponent("StatusBadge.tsx");

  assert.match(button, /type = "button"/);
  assert.match(button, /focus-visible:ring-2/);
  assert.match(button, /aria-busy=/);
  assert.match(button, /disabled=\{unavailable\}/);
  assert.match(iconButton, /"aria-label": string/);
  assert.match(progress, /role="progressbar"/);
  assert.match(progress, /aria-valuenow=/);
  assert.match(progress, /aria-valuemax=/);
  assert.match(statusBadge, /label: string/);
});

test("all primitive utility names are backed by the frozen token API", () => {
  const globals = readFileSync(join(root, "app", "globals.css"), "utf8");
  const sources = componentFiles.map(readComponent).join("\n");
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
