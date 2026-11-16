import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { a4Layout, splitLabelSheets, locationLabelUrl, A4_MARGIN, A4_GAP } from "../lib/labels/a4.ts";

test("A4 chooses maximum uniform grid, portrait on ties", () => {
  assert.equal(a4Layout(90, 40)?.orientation, "portrait");
  assert.equal(a4Layout(90, 40)?.capacity, 12);
  assert.equal(a4Layout(100, 55)?.orientation, "landscape");
  assert.equal(a4Layout(100, 55)?.capacity, 6);
  assert.equal(a4Layout(190, 277)?.capacity, 1);
});
test("all accepted dimensions fit margins without overlapping", () => {
  for (let w = 60; w <= 277; w += 7) for (let h = 30; h <= 277; h += 9) {
    const l = a4Layout(w, h);
    if (!l) continue;
    assert.ok(l.columns * w + (l.columns - 1) * A4_GAP <= l.pageWidth - 2 * A4_MARGIN);
    assert.ok(l.rows * h + (l.rows - 1) * A4_GAP <= l.pageHeight - 2 * A4_MARGIN);
  }
});
test("invalid and non-fitting sizes cannot produce sheets", () => {
  for (const [w,h] of [[0,40],[59,40],[90,29],[NaN,40],[Infinity,40],[278,40],[200,200]]) assert.equal(a4Layout(w,h), null);
  assert.deepEqual(splitLabelSheets([1],0),[]);
});
test("pagination preserves order, copies and a partial final sheet", () => {
  const labels = Array.from({length: 13}, (_,i) => String(i)).flatMap(code => [code,code]);
  const pages = splitLabelSheets(labels,12);
  assert.deepEqual(pages.map(p=>p.length),[12,12,2]);
  assert.deepEqual(pages.flat(),labels);
  assert.deepEqual(splitLabelSheets([],12),[]);
  assert.equal(splitLabelSheets(labels.slice(0,12),12).length,1);
});
test("QR destination is independent of localhost and preview", () => {
  assert.equal(locationLabelUrl("HL01-01-A"),"https://snakevkls-yh9b.vercel.app/locations/HL01-01-A");
  assert.ok(locationLabelUrl("A/B").endsWith("A%2FB"));
});
test("screen and print share sheets, print removes zoom and screen pagination", () => {
  const ui = readFileSync("app/locations/labels/A4Preview.tsx","utf8");
  assert.equal((ui.match(/sheets\.map/g)??[]).length,1);
  assert.match(ui,/transform: none !important/);
  assert.match(ui,/a4-sheet-frame:last-child \{ break-after: auto/);
  assert.match(ui,/data-visible="false".*display: block/);
  const page = readFileSync("app/locations/labels/page.tsx","utf8");
  assert.match(page,/preview-scroll h-\[620px\]/);
  assert.match(page,/labelFormat !== "a4" \|\| a4Valid/);
});
