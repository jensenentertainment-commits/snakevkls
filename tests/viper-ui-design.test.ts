import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const pages = ["page.tsx", "orders/[id]/page.tsx", "picks/[id]/page.tsx", "admin/order-intake/page.tsx", "admin/exceptions/page.tsx", "admin/recovery/page.tsx"];
const components = readdirSync("app/components/viper").filter(f => f.endsWith(".tsx"));
const read = (file: string) => readFileSync(file, "utf8");

test("Viper presentation uses canonical tokens without a separate palette or legacy phase text", () => {
  const sources = [...pages.map(p => read(`app/viper/${p}`)), ...components.map(p => read(`app/components/viper/${p}`))].join("\n");
  assert.doesNotMatch(sources, /#[0-9a-f]{3,8}\b|(?:bg|text|border)-(?:white|black|neutral|red|amber|emerald|blue)(?:-|\b)/i);
  assert.doesNotMatch(sources, /rounded-\[|Viper · P4\.1|Linjeplukk åpnes i neste fase/);
  assert.doesNotMatch(sources, /<button\b/);
});

test("Viper uses shared semantic progress, status and responsive controls", () => {
  const flow = read("app/components/viper/ViperPickFlow.tsx");
  assert.match(flow, /<Progress label="Plukkfremdrift" value=\{pick.completedLines\}/);
  assert.match(flow, /<Button[\s\S]*disabled=\{!readyToComplete \|\| busy\}/);
  const preview = read("app/components/viper/ShopifyOrderPreviewForm.tsx");
  assert.match(preview, /<StatusBadge tone=\{line.importable/);
  assert.match(preview, /grid-cols-1[^"]*sm:grid-cols-2/);
  const correction = read("app/components/viper/PickCorrection.tsx");
  assert.match(correction, /physicalReturnConfirmed:returned/);
  assert.match(correction, /disabled=\{busy\|\|!action\|\|!reason.trim\(\)\|\|!returned\}/);
  assert.match(correction, /focus-visible:ring-snake-focus/);
});
