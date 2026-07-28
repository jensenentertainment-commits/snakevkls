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

test("Location label formats and print contract remain unchanged", () => {
  const labels = readProjectFile("app/locations/labels/page.tsx");

  assert.match(
    labels,
    /zebra:[\s\S]+?width: "100mm",[\s\S]+?height: "55mm",[\s\S]+?qr: "24mm",[\s\S]+?codeSize: "35px"/,
  );
  assert.match(
    labels,
    /shipping:[\s\S]+?width: "109mm",[\s\S]+?height: "102mm",[\s\S]+?qr: "34mm",[\s\S]+?codeSize: "46px"/,
  );
  assert.match(
    labels,
    /brother:[\s\S]+?width: "103mm",[\s\S]+?height: "70mm",[\s\S]+?qr: "28mm",[\s\S]+?codeSize: "42px"/,
  );
  assert.match(labels, /@page \{[\s\S]+?size: var\(--label-width\) var\(--label-height\);[\s\S]+?margin: 0/);
  assert.match(labels, /page-break-after: always/);
  assert.match(labels, /break-after: page/);
  assert.match(labels, /padding: 4mm !important/);
  assert.match(labels, /printable\.flatMap/);
  assert.match(labels, /Array\.from\(\{ length: Math\.max\(1, copies\) \}/);
  assert.match(labels, /window\.print\(\)/);
  assert.match(labels, /QRCode\.toDataURL/);
  assert.match(labels, /\.from\("locations"\)/);
  assert.match(labels, /\.eq\("active", true\)/);
  assert.match(labels, /\.order\("code", \{ ascending: true \}\)/);
});
