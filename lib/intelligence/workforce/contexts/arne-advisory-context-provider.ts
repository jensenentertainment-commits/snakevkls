import "server-only";

import { getArneDevelopmentContext } from "@/lib/intelligence/arne/development-context";
import type { ContextProvider } from "../context-provider";
import type { ArneAdvisoryContext } from "./arne-advisory-context";

export const arneAdvisoryContextProvider = {
  id: "arne.advisory_context",
  capabilityId: "snake.assess_development",
  async provide(context) {
    const developmentContext = getArneDevelopmentContext();

    return {
      developmentContext,
      page: context.page,
    };
  },
} satisfies ContextProvider<ArneAdvisoryContext>;
