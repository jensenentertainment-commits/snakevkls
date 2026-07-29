import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function readProjectFile(file: string) {
  return readFileSync(join(root, file), "utf8");
}

test("Location labels relies on the Lager AppShell without a local shell", () => {
  const labels = readProjectFile("app/locations/labels/page.tsx");
  const navigation = readProjectFile(
    "app/components/navigation/modules.ts",
  );
  const appShell = readProjectFile("app/components/layout/AppShell.tsx");
  const appNavbar = readProjectFile("app/components/layout/AppNavbar.tsx");
  const moduleNav = readProjectFile("app/components/layout/ModuleNav.tsx");

  assert.match(navigation, /matchPaths: \[[\s\S]+?"\/locations"/);
  assert.doesNotMatch(labels, /SnakeNav|SnakeFooter|ModuleNav/);
  assert.doesNotMatch(labels, /min-h-screen|max-w-7xl|mx-auto/);
  assert.match(appShell, /print:max-w-none print:p-0/);
  assert.match(appNavbar, /print:hidden/);
  assert.match(moduleNav, /print:hidden/);
});

test("Location label formats use physical pages and print-only content", () => {
  const labels = readProjectFile("app/locations/labels/page.tsx");
  const askBorre = readProjectFile("app/components/AskBorre.tsx");

  assert.match(
    labels,
    /zebra:[\s\S]+?width: "100mm",[\s\S]+?height: "55mm",[\s\S]+?pageSize: "100mm 55mm"/,
  );
  assert.match(
    labels,
    /shipping:[\s\S]+?width: "109mm",[\s\S]+?height: "102mm",[\s\S]+?pageSize: "109mm 102mm"/,
  );
  assert.match(
    labels,
    /brother:[\s\S]+?width: "103mm",[\s\S]+?height: "70mm",[\s\S]+?pageSize: "103mm 70mm"/,
  );
  assert.match(labels, /@page \{[\s\S]+?size: \$\{labelDimensions\.pageSize\};[\s\S]+?margin: 0/);
  assert.doesNotMatch(labels, /size: var\(--label-width\) var\(--label-height\)/);
  assert.match(labels, /page-break-after: always/);
  assert.match(labels, /break-after: page/);
  assert.match(labels, /page-break-inside: avoid/);
  assert.match(labels, /break-inside: avoid/);
  assert.match(labels, /box-sizing: border-box !important/);
  assert.match(labels, /overflow: hidden !important/);
  assert.match(labels, /white-space: nowrap !important/);
  assert.equal((labels.match(/className="label-content/g) ?? []).length, 1);
  assert.doesNotMatch(labels, />\s*SNAKE OS\s*</);
  assert.equal((askBorre.match(/print:hidden/g) ?? []).length, 2);
  assert.match(labels, /printable\.flatMap/);
  assert.match(labels, /Array\.from\(\{ length: Math\.max\(1, copies\) \}/);
  assert.match(labels, /window\.print\(\)/);
  assert.match(labels, /QRCode\.toDataURL/);
  assert.match(labels, /\.from\("locations"\)/);
  assert.match(labels, /\.eq\("active", true\)/);
  assert.match(labels, /\.order\("code", \{ ascending: true \}\)/);
});
