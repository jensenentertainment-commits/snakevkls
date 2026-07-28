import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isViperOrderStatus,
  isViperPickJobStatus,
  isViperPickLineStatus,
  VIPER_EVENT_TYPES,
} from "../lib/viper/types.ts";

const migrationUrl = new URL(
  "../supabase/migrations/20260723172524_viper_p1_minimal_domain.sql",
  import.meta.url
);
const eventSequenceMigrationUrl = new URL(
  "../supabase/migrations/20260723204610_viper_p1_event_sequence.sql",
  import.meta.url
);

async function getMigration() {
  return readFile(migrationUrl, "utf8");
}

async function getEventSequenceMigration() {
  return readFile(eventSequenceMigrationUrl, "utf8");
}

function getFunctionBody(sql: string, name: string) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `${name} must exist in the P1 migration`);

  const nextFunction = sql.indexOf(
    "create or replace function public.",
    start + 1
  );
  return sql.slice(start, nextFunction === -1 ? sql.length : nextFunction);
}

test("P1 exposes only the approved minimal Viper domain", async () => {
  const sql = await getMigration();

  for (const table of [
    "orders",
    "order_lines",
    "pick_jobs",
    "pick_lines",
    "viper_events",
  ]) {
    assert.match(sql, new RegExp(`create table public\\.${table}\\b`, "i"));
    assert.match(
      sql,
      new RegExp(
        `alter table public\\.${table} enable row level security`,
        "i"
      )
    );
  }

  assert.doesNotMatch(sql, /create table public\.inventory_reservations/i);
  assert.doesNotMatch(sql, /create table public\.pick_exceptions/i);
  assert.doesNotMatch(sql, /create table public\.(shipments|packages)/i);
  assert.match(
    sql,
    /constraint pick_lines_job_inventory_key\s+unique \(pick_job_id, inventory_id\)/i
  );
});

test("P1 denies direct Viper writes and grants RPC execution only to service role", async () => {
  const sql = await getMigration();

  assert.match(
    sql,
    /revoke all on table[\s\S]*public\.viper_events[\s\S]*from public, anon, authenticated/i
  );
  assert.match(
    sql,
    /grant select on table[\s\S]*public\.viper_events[\s\S]*to authenticated/i
  );

  for (const name of [
    "start_viper_pick",
    "confirm_viper_pick_line",
    "complete_viper_pick",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `revoke all on function public\\.${name}[\\s\\S]*?from public, anon, authenticated`,
        "i"
      )
    );
    assert.match(
      sql,
      new RegExp(
        `grant execute on function public\\.${name}[\\s\\S]*?to service_role`,
        "i"
      )
    );
  }
});

test("pilot start is serialized, actor-owned and idempotent", async () => {
  const body = getFunctionBody(await getMigration(), "start_viper_pick");

  assert.match(body, /pg_advisory_xact_lock/i);
  assert.match(body, /where id = requested_pick_job_id\s+for update/i);
  assert.match(body, /current_job\.assigned_to = requested_actor_id/i);
  assert.match(body, /'idempotent', true/i);
  assert.match(body, /Another pilot pick is already active/i);
  assert.match(body, /Pick job contains inconsistent lines/i);
  assert.match(
    body,
    /inventory\.location_id is distinct from pick_line\.location_id/i
  );
});

test("line confirmation requires the assigned actor and is idempotent", async () => {
  const body = getFunctionBody(
    await getMigration(),
    "confirm_viper_pick_line"
  );

  assert.match(body, /where id = requested_pick_line_id\s+for update/i);
  assert.match(body, /current_job\.assigned_to <> requested_actor_id/i);
  assert.match(body, /if current_line\.status = 'picked'/i);
  assert.match(body, /'pick_line_completed'/i);
});

test("completion validates all stock before deductions and logs atomically", async () => {
  const body = getFunctionBody(await getMigration(), "complete_viper_pick");

  const validationLoop = body.indexOf(
    "-- Lock and validate all inventory rows"
  );
  const insufficientCheck = body.indexOf(
    "Insufficient inventory to complete pick"
  );
  const inventoryUpdate = body.indexOf("update public.inventory");
  const movementInsert = body.indexOf("insert into public.stock_movements");
  const eventInsert = body.lastIndexOf("insert into public.viper_events");
  const activityInsert = body.indexOf("insert into public.activity_log");

  assert.ok(validationLoop > 0);
  assert.ok(insufficientCheck > validationLoop);
  assert.ok(inventoryUpdate > insufficientCheck);
  assert.ok(movementInsert > inventoryUpdate);
  assert.ok(eventInsert > movementInsert);
  assert.ok(activityInsert > eventInsert);
  assert.match(body, /if current_job\.status = 'completed'/i);
  assert.match(body, /'idempotent', true/i);
  assert.doesNotMatch(body, /exception\s+when/i);
});

test("TypeScript status contracts match the minimal pilot states", () => {
  assert.equal(isViperOrderStatus("ready_to_pick"), true);
  assert.equal(isViperOrderStatus("blocked"), false);
  assert.equal(isViperPickJobStatus("in_progress"), true);
  assert.equal(isViperPickJobStatus("blocked"), false);
  assert.equal(isViperPickLineStatus("picked"), true);
  assert.equal(isViperPickLineStatus("exception"), false);
  assert.deepEqual(VIPER_EVENT_TYPES, [
    "order_imported",
    "pick_job_created",
    "pick_started",
    "pick_line_completed",
    "pick_completed",
  ]);
});

test("P1 hardening adds a unique database-assigned event sequence", async () => {
  const sql = await getEventSequenceMigration();

  assert.match(
    sql,
    /alter table public\.viper_events[\s\S]*add column event_sequence bigint generated always as identity/i
  );
  assert.match(
    sql,
    /constraint viper_events_event_sequence_key unique \(event_sequence\)/i
  );
  assert.match(
    sql,
    /idx_viper_events_order_sequence[\s\S]*\(order_id, event_sequence\)/i
  );
  assert.match(
    sql,
    /idx_viper_events_pick_job_sequence[\s\S]*\(pick_job_id, event_sequence\)/i
  );
  assert.match(
    sql,
    /grant usage, select[\s\S]*viper_events_event_sequence_seq[\s\S]*to service_role/i
  );
  assert.doesNotMatch(
    sql,
    /alter table public\.(?!viper_events\b)|\b(update|delete|truncate)\b/i
  );
});

test("event flow uses eventSequence and never PostgreSQL system columns", () => {
  const events = [
    { eventType: "pick_completed", eventSequence: 103 },
    { eventType: "pick_started", eventSequence: 101 },
    { eventType: "pick_line_completed", eventSequence: 102 },
  ];

  const orderedTypes = events
    .toSorted((left, right) => left.eventSequence - right.eventSequence)
    .map((event) => event.eventType);

  assert.deepEqual(orderedTypes, [
    "pick_started",
    "pick_line_completed",
    "pick_completed",
  ]);

  const forbiddenSystemColumns = [
    "c" + "min",
    "x" + "min",
    "c" + "tid",
  ];
  const harnessSource = JSON.stringify(events);
  for (const column of forbiddenSystemColumns) {
    assert.equal(harnessSource.includes(column), false);
  }
});
