import type { ReadCapabilityDefinition } from "../capability";

export const snakeAssessDevelopmentCapability = {
  id: "snake.assess_development",
  effect: "read",
  dataSourceIds: [
    "snake.development_context",
  ],
} as const satisfies ReadCapabilityDefinition;
