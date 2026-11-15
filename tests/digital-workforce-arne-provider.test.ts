import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildArneModelInput,
  formatArneBackgroundContext,
} from "../lib/intelligence/arne/chat-input-builder.ts";
import { getArneDevelopmentContext } from "../lib/intelligence/arne/development-context.ts";
import type { ArneAdvisoryContext } from "../lib/intelligence/workforce/contexts/arne-advisory-context.ts";

const context: ArneAdvisoryContext = {
  developmentContext: getArneDevelopmentContext(),
  page: "/arne",
};

test("Arne formatter includes reviewed context only", () => {
  assert.equal(
    formatArneBackgroundContext(context),
    `
Dette er bakgrunnsinformasjon om Snake.
Den skal bare brukes når den er relevant for admins spørsmål.
Ikke analyser eller foreslå tiltak utelukkende fordi informasjonen finnes her.

=== Development Context ===

${JSON.stringify(context.developmentContext, null, 2)}

=== Current Page ===

/arne
`
  );
});

test("Arne model input preserves system, context, history, question order", () => {
  assert.deepEqual(
    buildArneModelInput({
      systemPrompt: "System fixture",
      context,
      history: [
        { role: "user", text: "Earlier question" },
        { role: "assistant", text: "Earlier answer" },
      ],
      question: "Current question",
    }).map((message) => [message.role, message.content]),
    [
      ["system", "System fixture"],
      ["user", formatArneBackgroundContext(context)],
      ["user", "Earlier question"],
      ["assistant", "Earlier answer"],
      ["user", "Current question"],
    ]
  );
});

test("Arne provider composes only today's existing context sources", async () => {
  const provider = await readFile(
    new URL(
      "../lib/intelligence/workforce/contexts/arne-advisory-context-provider.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(provider, /import "server-only"/);
  assert.doesNotMatch(provider, /buildSnakeKnowledgePrompt|getSnakeOperationalContext/);
  assert.match(provider, /getArneDevelopmentContext\(\)/);
  assert.match(provider, /capabilityId: "snake\.assess_development"/);
  assert.doesNotMatch(
    provider,
    /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|\btools\b|\bhandoff\b/i
  );
});

test("Legacy operational objects cannot leak into Arne model background", () => {
  const legacy = { ...context, operationalContext: { stats: { latestActivity: { actor_email: "private@example.invalid" } }, health: { score: 12 } }, snakeKnowledge: "OUTDATED KNOWLEDGE" };
  const messages = buildArneModelInput({ systemPrompt: "System", context: legacy, history: [], question: "Hva vet du?" });
  const output = JSON.stringify(messages);
  assert.doesNotMatch(output, /private@example|actor_email|OUTDATED KNOWLEDGE|"score"/);
  assert.match(output, /ikke en live driftskontroll/);
});

test("Arne declares only the source actually supplied to the model", async () => {
  const source = await readFile(new URL("../lib/intelligence/workforce/capabilities/snake-assess-development.ts", import.meta.url), "utf8");
  assert.match(source, /dataSourceIds:\s*\[\s*"snake.development_context",?\s*\]/);
  assert.doesNotMatch(source, /dashboard_stats|missing_location_products|latest_activity|snake\.knowledge/);
});
