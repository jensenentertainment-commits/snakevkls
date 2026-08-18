import type { ReadCapabilityDefinition } from "../capability";

export const warehouseReadSummaryCapability = {
  id: "warehouse.read_summary",
  effect: "read",
  dataSourceIds: [
    "snake.knowledge",
    "warehouse.dashboard_stats",
    "warehouse.missing_location_products",
  ],
} as const satisfies ReadCapabilityDefinition;
