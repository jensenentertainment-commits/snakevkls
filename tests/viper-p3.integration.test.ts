import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isViperPickExceptionType,
  VIPER_PICK_EXCEPTION_TYPES,
} from "../lib/viper/picks/validation.ts";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("P3 migration is isolated and models only narrow pick exceptions", async () => {
  const sql = await source(
    "supabase/migrations/20260724182902_viper_p3_line_picking.sql"
  );
  assert.match(sql, /add column picked_by uuid references auth\.users/i);
  assert.match(sql, /create table public\.pick_exceptions/i);
  assert.match(sql, /pick_exceptions_one_open_per_line_idx/i);
  assert.match(sql, /add column exception_id uuid/i);
  assert.match(sql, /enable row level security/i);
  assert.doesNotMatch(sql, /\b(update|insert into)\s+public\.shopify/i);
  assert.doesNotMatch(sql, /create table public\.(shipments|packages|inventory_reservations)/i);
});

test("P3 RPCs enforce ownership, open-exception blocking and idempotency", async () => {
  const sql = await source(
    "supabase/migrations/20260724182902_viper_p3_line_picking.sql"
  );
  assert.match(sql, /create or replace function public\.report_viper_pick_exception/i);
  assert.match(sql, /create or replace function public\.resolve_viper_pick_exception/i);
  assert.match(sql, /current_job\.assigned_to <> requested_actor_id/i);
  assert.match(sql, /Pick line has an open exception/i);
  assert.match(sql, /Pick job has open exceptions/i);
  assert.match(sql, /'idempotent', true/i);
  assert.match(sql, /picked_by = requested_actor_id/i);
  assert.match(sql, /nullif\(btrim\(requested_resolution_note\), ''\) is null/i);
});

test("P3 completion validates all inventory before any deduction", async () => {
  const sql = await source(
    "supabase/migrations/20260724182902_viper_p3_line_picking.sql"
  );
  const completeStart = sql.indexOf("create or replace function public.complete_viper_pick");
  const complete = sql.slice(completeStart);
  const validation = complete.indexOf("Lock and validate every inventory row");
  const insufficient = complete.indexOf("Insufficient inventory");
  const update = complete.indexOf("update public.inventory");
  const movement = complete.indexOf("insert into public.stock_movements");
  assert.ok(validation > 0);
  assert.ok(insufficient > validation);
  assert.ok(update > insufficient);
  assert.ok(movement > update);
  assert.doesNotMatch(complete, /exception\s+when/i);
});

test("P3 routes authorize every mutation and delegate inventory writes to RPC", async () => {
  const paths = [
    "app/api/viper/pick-lines/[id]/confirm/route.ts",
    "app/api/viper/pick-lines/[id]/exceptions/route.ts",
    "app/api/viper/picks/[id]/complete/route.ts",
    "app/api/viper/admin/exceptions/[id]/resolve/route.ts",
  ];
  const routes = await Promise.all(paths.map(source));
  for (const route of routes) {
    assert.match(route, /requireViper(?:Admin)?ApiActor\(\)/);
    assert.doesNotMatch(route, /\.from\(["']inventory["']\)[\s\S]*update/);
  }
  assert.match(routes[0], /confirmViperPickLine/);
  assert.match(routes[1], /reportViperPickException/);
  assert.match(routes[2], /completeViperPick/);
  assert.match(routes[3], /resolveViperPickException/);
});

test("P3 exception types are closed and reject unknown workflow expansion", () => {
  assert.deepEqual(VIPER_PICK_EXCEPTION_TYPES, [
    "item_not_found",
    "wrong_quantity",
    "damaged",
  ]);
  assert.equal(isViperPickExceptionType("damaged"), true);
  assert.equal(isViperPickExceptionType("substitution"), false);
  assert.equal(isViperPickExceptionType("short_pick"), false);
});

test("P3 mobile UI exposes one current line and delays inventory completion", async () => {
  const flow = await source("app/components/viper/ViperPickFlow.tsx");
  const start = await source("app/components/viper/StartPickButton.tsx");
  assert.match(flow, /find\(\(line\) => line\.status === "pending"\)/);
  assert.match(flow, /Bekreft plukket/);
  assert.match(flow, /Registrer avvik/);
  assert.match(flow, /Fullfør plukk/);
  assert.match(start, /router\.push\(`\/viper\/picks\//);
  assert.doesNotMatch(flow, /shopify|fulfillment/i);
});
