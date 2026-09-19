import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyObservedField } from "../lib/intelligence/roy/product-content-contract.ts";
import { ROY_CATALOG_FOUNDATION_FINDINGS, ROY_CATALOG_FOUNDATION_LIMITATIONS } from "../lib/intelligence/roy/catalog-foundation-contract.ts";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = "supabase/migrations/20260917200011_phase_2a_catalog_foundation_rpc.sql";

// Static SQL contracts, not executable PostgreSQL validation.
test("RPC is stable, invoker-only, explicitly authorized before data reads, and additive", async () => {
  const sql = await read(migration);
  assert.match(sql, /create function public\.get_roy_catalog_foundation_v1\(\)/);
  assert.match(sql, /stable\s+security invoker\s+set search_path = ''/);
  assert.match(sql, /private\.has_role\(array\['admin', 'user'\]::text\[\]\)\) is not true/);
  assert.ok(sql.indexOf("errcode = '42501'") < sql.indexOf("with active_variants"));
  assert.match(sql, /revoke all on function public\.get_roy_catalog_foundation_v1\(\) from public, anon, authenticated, service_role;/);
  assert.match(sql, /grant execute on function public\.get_roy_catalog_foundation_v1\(\) to authenticated;/);
  const statements = sql.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(statements, /\b(insert|update|delete|truncate|create index|create table|create materialized|alter table|security definer|execute)\b(?! on)/i);
  assert.doesNotMatch(sql, /for update|pg_advisory|private\.sync_runs/);
});

test("active variant population owns scope and canonical memberships are preaggregated", async () => {
  const sql = await read(migration);
  assert.match(sql, /where p\.active = true and p\.shopify_product_id is not null/);
  assert.match(sql, /from active_variants as v group by v\.shopify_product_id/);
  assert.match(sql, /membership_counts as \([\s\S]*?group by m\.shopify_product_id/);
  assert.match(sql, /left join public\.shopify_product_content as c on c\.shopify_product_id = p\.shopify_product_id/);
  assert.doesNotMatch(sql, /shopify_status|public\.product_collections\b/);
  assert.match(sql, /'variantCount', \(select count\(\*\) from active_variants\)/);
});

test("SQL whitespace declaration matches ECMAScript trim, including Unicode and deliberate exclusions", async () => {
  const sql = await read(migration);
  const declaration = /trim_chars constant text := U&'([^']+)'/.exec(sql)![1];
  const points = [...declaration.matchAll(/\\([0-9A-F]{4})/g)].map((match) => parseInt(match[1], 16));
  const sqlTrim = new Set(points.map((point) => String.fromCodePoint(point)));
  assert.equal(sqlTrim.size, 25);
  for (let point = 0; point <= 0xffff; point += 1) {
    const character = String.fromCharCode(point);
    assert.equal(sqlTrim.has(character), character.trim() === "", `U+${point.toString(16)}`);
    if (sqlTrim.has(character)) assert.equal(classifyObservedField({ state: "observed" }, character), "missing");
  }
  assert.match(sql, /nullif\(btrim\(f\.value, trim_chars\), ''\) is null then 'missing'/);
  assert.match(sql, /when not p\.observed then 'unknown'/);
});

test("malformed categories fail the response and incomplete membership is not counted as zero", async () => {
  const sql = await read(migration);
  assert.match(sql, /shopify_category_id is null and p\.shopify_category_full_name is null/);
  assert.match(sql, /btrim\(p\.shopify_category_full_name, trim_chars\)/);
  assert.match(sql, /if invalid_observation then[\s\S]*?errcode = '22000'/);
  assert.match(sql, /where complete and membership_count = 0/);
  assert.match(sql, /where not complete/);
  assert.match(sql, /case when p\.complete then p\.collections_observed_at end/);
});

test("evidence is deterministically bounded before JSON construction and byte trimming never changes counts", async () => {
  const sql = await read(migration);
  assert.match(sql, /partition by m\.code order by m\.shopify_product_id collate "C"/);
  assert.match(sql, /example_rank <= 8 order by e\.example_rank, e\.finding_order limit 24/);
  assert.match(sql, /left\(l\.label, 240\)/);
  assert.match(sql, /left\(l\.sku, 120\)/);
  assert.match(sql, /octet_length\(convert_to\(proposed::text, 'UTF8'\)\) <= 32768/);
  assert.match(sql, /octet_length\(convert_to\(result::text, 'UTF8'\)\) > 32768/);
  const budgetLoop = sql.slice(sql.indexOf("for candidate in"));
  assert.doesNotMatch(budgetLoop, /jsonb_set\([^\n]*(?:totals|fields|collections|affectedProductCount)/);
  assert.match(budgetLoop, /'\{evidence,budgetLimited\}', 'true'/);
  assert.match(sql, /!~\* 'gid:\/\/shopify\/'/);
  const output = sql.slice(sql.indexOf("select jsonb_build_object(\n    'schemaVersion'"), sql.indexOf("into result, candidates"));
  assert.doesNotMatch(output, /'shopifyProductId'|'shopifyVariantId'|'vendor'|'description', p\.|'seoTitle', p\./);
  for (const code of ROY_CATALOG_FOUNDATION_FINDINGS) assert.ok(sql.includes(`'${code}'`));
  for (const limitation of ROY_CATALOG_FOUNDATION_LIMITATIONS) assert.ok(sql.includes(limitation.replaceAll("'", "''")));
});

test("foundation integration is separately gated and remains disabled by default", async () => {
  const gate = await read("lib/intelligence/roy/phase2a-gate.ts");
  assert.match(gate, /import "server-only"/);
  assert.match(gate, /process.env.ROY_PHASE2A_ENABLED === "true"/);
  const provider = await read("lib/intelligence/workforce/contexts/shopify-catalog-provider.ts");
  assert.ok(provider.indexOf("if (royPhase2aEnabled())") < provider.indexOf("readPhase2aContext(route"));
  assert.match(provider, /const intent = resolveRoyQueryIntent\(input\)/);
  assert.doesNotMatch(await read("lib/intelligence/roy/system.ts"), /get_roy_catalog_foundation|catalog-foundation-contract/);
});
