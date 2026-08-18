import type { ReadCapabilityDefinition } from "../capability";

export const snakeAssessDevelopmentCapability = {
  id: "snake.assess_development",
  effect: "read",
  dataSourceIds: [
    "snake.knowledge",
    "snake.development_context",
    "warehouse.dashboard_stats",
    "warehouse.missing_location_products",
    "snake.latest_activity",
  ],
} as const satisfies ReadCapabilityDefinition;
