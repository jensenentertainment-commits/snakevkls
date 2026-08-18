import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildArneModelInput,
  formatArneBackgroundContext,
} from "../lib/intelligence/arne/chat-input-builder.ts";
import type { ArneAdvisoryContext } from "../lib/intelligence/workforce/contexts/arne-advisory-context.ts";

const context: ArneAdvisoryContext = {
  snakeKnowledge: "Snake knowledge fixture",
  developmentContext: {
    project: "Snake OS",
    purpose: "Purpose fixture",
    currentStatus: { phase: "Phase", users: "Users", mainFocus: "Focus" },
    currentModules: ["Dashboard"],
    plannedModules: ["Arne"],
    principles: ["Small steps"],
    currentSprint: ["Current work"],
    nextLikelyWork: ["Next work"],
  },
  operationalContext: {
    stats: {
      missingLocationCount: 2,
      missingSkuCount: 3,
      emptyLocationCount: 4,
      activeProductCount: 10,
      placedProductCount: 8,
      quantityDiffCount: 1,
      locationsNoZoneCount: 5,
      latestActivity: null,
      latestShopifySync: null,
    },
    health: { score: 80, level: "stable" },
    warehouse: {
      activeProducts: 10,
      placedProducts: 8,
      quantityDiffs: 1,
      missingLocations: 2,
      missingSku: 3,
      emptyLocations: 4,
      locationsWithoutZone: 5,
    },
    shopifySync: null,
    missingLocationProducts: [],
  },
  page: "/arne",
};

test("Arne formatter is equivalent to today's background context", () => {
  assert.equal(
    formatArneBackgroundContext(context),
    `
Dette er bakgrunnsinformasjon om Snake.
Den skal bare brukes når den er relevant for admins spørsmål.
Ikke analyser eller foreslå tiltak utelukkende fordi informasjonen finnes her.

=== Snake Knowledge ===

Snake knowledge fixture

=== Development Context ===

${JSON.stringify(context.developmentContext, null, 2)}

=== Operational Context ===

${JSON.stringify(context.operationalContext, null, 2)}

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
  assert.match(provider, /buildSnakeKnowledgePrompt\(\)/);
  assert.match(provider, /getSnakeOperationalContext\(\)/);
  assert.match(provider, /getArneDevelopmentContext\(\)/);
  assert.match(provider, /capabilityId: "snake\.assess_development"/);
  assert.doesNotMatch(
    provider,
    /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|\btools\b|\bhandoff\b/i
  );
});
