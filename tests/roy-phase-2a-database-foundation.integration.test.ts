import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260907195256_phase_2a_product_content_foundation.sql",
  import.meta.url,
);

async function migrationSql() {
  return readFile(migrationUrl, "utf8");
}

test("Phase 2A creates only the additive product-level foundation", async () => {
  const sql = await migrationSql();
  const tables = Array.from(
    sql.matchAll(/create table public\.([a-z0-9_]+)/giu),
    (match) => match[1],
  );

  assert.deepEqual(tables, [
    "shopify_product_content",
    "shopify_product_collections",
  ]);
  assert.doesNotMatch(sql, /alter table public\.(products|product_collections)\b/iu);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+(?:from\s+|into\s+)?public\./iu);
});

test("product content is keyed by stable Shopify product identity", async () => {
  const sql = await migrationSql();

  assert.match(sql, /shopify_product_id text primary key/iu);
  assert.match(sql, /\^gid:\/\/shopify\/Product\/\[0-9\]\+\$/u);
  assert.match(sql, /product_type text/iu);
  assert.match(sql, /shopify_category_id text/iu);
  assert.match(sql, /shopify_category_full_name text/iu);
  assert.match(sql, /TaxonomyCategory/iu);
});

test("content observation preserves UNKNOWN separately from observed missing", async () => {
  const sql = await migrationSql();
  const observationConstraint = sql.slice(
    sql.indexOf("constraint shopify_product_content_observation_valid"),
    sql.indexOf("constraint shopify_product_content_category_valid"),
  );

  assert.match(observationConstraint, /content_observed_at is null/iu);
  for (const field of [
    "product_name",
    "description",
    "seo_title",
    "seo_description",
    "product_handle",
    "product_type",
    "shopify_category_id",
    "shopify_category_full_name",
    "vendor",
    "shopify_status",
    "image_url",
    "shopify_updated_at",
  ]) {
    assert.match(observationConstraint, new RegExp(`${field} is null`, "iu"));
  }
  assert.match(
    observationConstraint,
    /content_observed_at is not null[\s\S]*description is not null/iu,
  );
  assert.doesNotMatch(sql, /description text not null/iu);
  assert.doesNotMatch(sql, /seo_(?:title|description) text not null/iu);
});

test("Shopify category and product type cannot collapse into one concept", async () => {
  const sql = await migrationSql();

  assert.match(sql, /product_type text/iu);
  assert.match(sql, /shopify_category_id text/iu);
  assert.match(sql, /shopify_category_full_name text/iu);
  assert.match(
    sql,
    /shopify_category_id is null[\s\S]*shopify_category_full_name is null[\s\S]*or[\s\S]*TaxonomyCategory/iu,
  );
  assert.doesNotMatch(sql, /product_type[^,\n]*references/iu);
});

test("collection membership distinguishes complete empty from unknown or incomplete", async () => {
  const sql = await migrationSql();

  assert.match(sql, /collections_complete boolean not null default false/iu);
  assert.match(sql, /collections_observed_at timestamptz/iu);
  assert.match(
    sql,
    /collections_complete is false\s+or collections_observed_at is not null/iu,
  );
  assert.doesNotMatch(sql, /collections_complete boolean not null default true/iu);
  assert.doesNotMatch(sql, /insert into public\.shopify_product_collections/iu);
});

test("product collections use a product-level foreign key and indexed identities", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /primary key \(\s*shopify_product_id,\s*shopify_collection_id\s*\)/iu,
  );
  assert.match(
    sql,
    /references public\.shopify_product_content\(shopify_product_id\)\s+on delete cascade/iu,
  );
  assert.match(
    sql,
    /shopify_product_collections_collection_id_idx[\s\S]*\(shopify_collection_id\)/iu,
  );
  assert.match(sql, /shopify_product_content_handle_key/iu);
  assert.match(sql, /shopify_product_content_unobserved_idx/iu);
  assert.match(sql, /shopify_product_content_incomplete_collections_idx/iu);
});

test("new product tables enforce admin-user read-only Data API access", async () => {
  const sql = await migrationSql();

  for (const table of [
    "shopify_product_content",
    "shopify_product_collections",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `alter table public\\.${table} enable row level security`,
        "iu",
      ),
    );
  }
  assert.match(
    sql,
    /private\.has_role\(array\['admin', 'user'\]::text\[\]\)/iu,
  );
  assert.doesNotMatch(sql, /array\[[^\]]*'warehouse'/iu);
  assert.match(
    sql,
    /revoke all on table[\s\S]*from public, anon, authenticated/iu,
  );
  assert.match(
    sql,
    /grant select on table[\s\S]*to authenticated/iu,
  );
  assert.doesNotMatch(
    sql,
    /grant (?:insert|update|delete|all privileges)[\s\S]*to authenticated/iu,
  );
  assert.match(
    sql,
    /grant all privileges on table[\s\S]*to service_role/iu,
  );
});

test("schema foundation introduces no sync, RPC, Roy, or Shopify write behavior", async () => {
  const sql = await migrationSql();

  assert.doesNotMatch(sql, /create (?:or replace )?function/iu);
  assert.doesNotMatch(sql, /\bgraphql\b|shopify mutation|receivedFields/iu);
  assert.doesNotMatch(sql, /public\.apply_shopify_sync_page/iu);
});
