import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("contract role type contains exactly admin, user, and warehouse", async () => {
  const roles = await source("lib/auth/roles.ts");

  assert.match(roles, /TARGET_ROLES = \["admin", "user", "warehouse"\]/);
  assert.match(roles, /ROLES = TARGET_ROLES/);
  assert.doesNotMatch(roles, /LEGACY_ROLES|"lager"/);
});

test("contract route and workforce guards reject the legacy role", async () => {
  const sources = await Promise.all([
    source("app/api/borre/ask/route.ts"),
    source("app/api/snakeboard/route.ts"),
    source("app/api/warehouse-sales/complete/route.ts"),
    source("lib/viper/auth/access.ts"),
    source("lib/intelligence/workforce/workforce-authorization.ts"),
  ]);

  for (const current of sources) {
    assert.doesNotMatch(current, /"lager"/);
  }
});

test("contract migration fails closed until legacy profiles are zero", async () => {
  const migration = await source(
    "supabase/migrations/20260819200716_role_model_contract.sql",
  );

  assert.match(
    migration,
    /if exists \(select 1 from public\.profiles where role = 'lager'\)/,
  );
  assert.match(
    migration,
    /raise exception 'Contract blocked: legacy lager profiles still exist'/,
  );
  assert.match(migration, /role in \('admin', 'user', 'warehouse'\)/);
  assert.doesNotMatch(
    migration,
    /role in \('admin', 'user', 'warehouse', 'lager'\)/,
  );
  assert.match(
    migration,
    /array\['admin', 'user', 'warehouse'\]::text\[\]/,
  );
  assert.match(
    migration,
    /array\['admin', 'user'\]::text\[\]/,
  );
  assert.doesNotMatch(migration, /update\s+public\.profiles/i);
});

test("contract migration removes legacy authorization from warehouse sales", async () => {
  const migration = await source(
    "supabase/migrations/20260819200716_role_model_contract.sql",
  );

  assert.match(
    migration,
    /profile\.role in \(''admin'', ''user'', ''lager''\)/,
  );
  assert.match(
    migration,
    /'profile\.role in \(''admin'', ''user''\)'/,
  );
  assert.match(
    migration,
    /contracted_definition like '%''lager''%'/,
  );
});
