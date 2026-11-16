import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createLabelQrCache } from "../lib/labels/qr-cache.ts";

test("generates only selected variant and reuses completed and pending images", async () => {
  const calls: unknown[] = [];
  const cache = createLabelQrCache(async (url, options) => { calls.push([url,options]); return `${url}:${options.width}`; });
  const first = cache.get("location-a", "standard");
  assert.equal(cache.get("location-a", "standard"),first);
  assert.equal(await first,"location-a:360");
  assert.equal(await cache.get("location-a", "standard"),"location-a:360");
  assert.deepEqual(calls,[["location-a",{width:360,margin:1}]]);
  assert.equal(await cache.get("location-a", "a4"),"location-a:600");
  await cache.get("location-a", "standard");
  assert.equal(calls.length,2);
});

test("out of order completion keeps variant and URL caches separate", async () => {
  const resolve: ((value:string)=>void)[]=[];
  const cache=createLabelQrCache(()=>new Promise<string>(r=>resolve.push(r)));
  const standard=cache.get("a","standard"), a4=cache.get("a","a4"), other=cache.get("b","standard");
  await Promise.resolve();
  resolve[1]("a4"); resolve[2]("other"); resolve[0]("standard");
  assert.deepEqual(await Promise.all([standard,a4,other]),["standard","a4","other"]);
  assert.equal(await cache.get("a","a4"),"a4");
});

test("failed images can be retried and successful cache entries survive", async () => {
  let fail=true;
  const cache=createLabelQrCache(async()=>{if(fail)throw new Error("synthetic");return "ok";});
  await assert.rejects(cache.get("a","a4"));
  fail=false;
  assert.equal(await cache.get("a","a4"),"ok");
});

test("page gates preview and printing on matching complete results and cancels stale completion", () => {
  const page=readFileSync("app/locations/labels/page.tsx","utf8");
  assert.match(page,/qrResult\?\.source === locations && qrResult.variant === qrVariant/);
  assert.match(page,/if \(!cancelled\) setQrResult/);
  assert.match(page,/cancelled = true/);
  assert.match(page,/disabled=\{!qrReady/);
  assert.match(page,/if \(qrReady && printableWithCopies.length/);
  assert.match(page,/!qrReady \? \(/);
  assert.doesNotMatch(page,/a4Qr/);
});
