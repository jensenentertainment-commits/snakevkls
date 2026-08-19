import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the application contracts to exactly three target roles", async () => {
  const roles = await source("lib/auth/roles.ts");

  assert.match(roles, /TARGET_ROLES = \["admin", "user", "warehouse"\]/);
  assert.match(roles, /ROLES = TARGET_ROLES/);
  assert.doesNotMatch(roles, /LEGACY_ROLES/);
});

test("navigation separates ordinary users from warehouse-only scope", async () => {
  const [dashboard, shell] = await Promise.all([
    source("app/dashboard/page.tsx"),
    source("app/components/shell/AuthenticatedAppShell.tsx"),
  ]);

  assert.match(
    dashboard,
    /id: "lager",[\s\S]*roles: \["admin", "user", "warehouse"\]/,
  );
  assert.match(
    dashboard,
    /id: "lagersalg",[\s\S]*roles: \["admin", "user"\]/,
  );
  assert.match(
    dashboard,
    /id: "viper",[\s\S]*roles: \["admin", "user", "warehouse"\]/,
  );
  assert.doesNotMatch(shell, /fallbackProfile/);
  assert.match(shell, /warehouse: "Lager"/);
});

test("route authorization keeps warehouse out of Lagersalg", async () => {
  const [sale, viper, borre, arne] = await Promise.all([
    source("app/api/warehouse-sales/complete/route.ts"),
    source("lib/viper/auth/access.ts"),
    source("app/api/borre/ask/route.ts"),
    source("app/api/arne/ask/route.ts"),
  ]);

  assert.match(sale, /requireRole\(\["admin", "user"\]\)/);
  assert.doesNotMatch(sale, /"warehouse"/);
  assert.match(
    viper,
    /requireRole\(\["admin", "user", "warehouse"\]\)/,
  );
  assert.match(
    borre,
    /requireRole\(\["admin", "user", "warehouse"\]\)/,
  );
  assert.match(arne, /requireRole\(\["admin"\]\)/);
});

test("expand migration hardens catalog RLS and preserves a controlled transition", async () => {
  const migration = await source(
    "supabase/migrations/20260819192637_role_model_expand.sql",
  );

  assert.match(
    migration,
    /role in \('admin', 'user', 'warehouse', 'lager'\)/,
  );
  assert.match(migration, /alter column role drop default/);
  assert.match(migration, /drop policy if exists "Authenticated read products"/);
  assert.match(migration, /create policy "Active roles read products"/);
  assert.match(
    migration,
    /create policy "Business roles read warehouse sales"[\s\S]*array\['admin', 'user', 'lager'\]/,
  );
  assert.match(
    migration,
    /profile\.role in \('admin', 'user', 'lager'\)/,
  );
  assert.doesNotMatch(
    migration,
    /profile\.role in \('admin', 'user', 'warehouse'/,
  );
  assert.match(
    migration,
    /grant select on table public\.products, public\.product_collections to authenticated/,
  );
  assert.doesNotMatch(migration, /update\s+public\.profiles/i);
});
