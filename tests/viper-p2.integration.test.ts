import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canReadViperPick,
  canStartViperPick,
} from "../lib/viper/auth/resource-access.ts";
import { isUuid } from "../lib/viper/orders/validation.ts";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("P2 resource access exposes ready work and only the actor's active pick", () => {
  const actorId = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";

  assert.equal(
    canReadViperPick({ status: "ready", assignedTo: null }, actorId),
    true
  );
  assert.equal(
    canReadViperPick(
      { status: "in_progress", assignedTo: actorId },
      actorId
    ),
    true
  );
  assert.equal(
    canReadViperPick(
      { status: "in_progress", assignedTo: otherId },
      actorId
    ),
    false
  );
  assert.equal(
    canReadViperPick({ status: "completed", assignedTo: actorId }, actorId),
    false
  );
  assert.equal(
    canStartViperPick(
      { status: "in_progress", assignedTo: otherId },
      actorId
    ),
    false
  );
});

test("P2 validates resource identifiers before database access", () => {
  assert.equal(isUuid("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isUuid("not-an-id"), false);
  assert.equal(isUuid("11111111-1111-1111-1111-111111111111"), false);
});

test("P2 API routes require Viper authorization and expose no direct writes", async () => {
  const queueRoute = await source("app/api/viper/orders/route.ts");
  const detailRoute = await source("app/api/viper/orders/[id]/route.ts");
  const startRoute = await source("app/api/viper/picks/[id]/start/route.ts");

  for (const route of [queueRoute, detailRoute, startRoute]) {
    assert.match(route, /requireViperApiActor\(\)/);
    assert.match(route, /Cache-Control|auth\.response/);
  }

  assert.match(startRoute, /startViperPick/);
  assert.doesNotMatch(startRoute, /\.from\(["']inventory["']\)/);
  assert.doesNotMatch(startRoute, /confirm_viper_pick_line|complete_viper_pick/);
});

test("P2 repository delegates start to the locked P1 RPC only", async () => {
  const repository = await source("lib/viper/orders/repository.ts");

  assert.match(repository, /\.rpc\("start_viper_pick"/);
  assert.doesNotMatch(repository, /\.rpc\("confirm_viper_pick_line"/);
  assert.doesNotMatch(repository, /\.rpc\("complete_viper_pick"/);
  assert.doesNotMatch(repository, /\.from\("inventory"\)\s*\.update/);
});

test("P2 UI has one primary start action and no picking completion controls", async () => {
  const queuePage = await source("app/viper/page.tsx");
  const detailPage = await source("app/viper/orders/[id]/page.tsx");
  const startButton = await source(
    "app/components/viper/StartPickButton.tsx"
  );

  assert.match(queuePage, /Ditt aktive plukk/);
  assert.match(queuePage, /Klar til plukk/);
  assert.match(detailPage, /StartPickButton/);
  assert.match(startButton, /Start plukk/);
  assert.doesNotMatch(
    `${detailPage}\n${startButton}`,
    /Bekreft linje|Fullfør plukk|Registrer avvik/
  );
});
