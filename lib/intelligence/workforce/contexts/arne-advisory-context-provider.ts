import "server-only";

import { getArneDevelopmentContext } from "@/lib/intelligence/arne/development-context";
import { buildSnakeKnowledgePrompt } from "@/lib/intelligence/shared/build-snake-knowledge";
import { getSnakeOperationalContext } from "@/lib/intelligence/shared/operational-context";
import type { ContextProvider } from "../context-provider";
import type { ArneAdvisoryContext } from "./arne-advisory-context";

export const arneAdvisoryContextProvider = {
  id: "arne.advisory_context",
  capabilityId: "snake.assess_development",
  async provide(context) {
    const snakeKnowledge = buildSnakeKnowledgePrompt();
    const operationalContext = await getSnakeOperationalContext();
    const developmentContext = getArneDevelopmentContext();

    return {
      snakeKnowledge,
      developmentContext,
      operationalContext,
      page: context.page,
    };
  },
} satisfies ContextProvider<ArneAdvisoryContext>;
