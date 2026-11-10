import type { ReadCapabilityDefinition } from "../capability";

export const warehouseReadSummaryCapability = {
  id: "warehouse.read_summary",
  effect: "read",
  dataSourceIds: [
    "warehouse.stored_stock",
  ],
} as const satisfies ReadCapabilityDefinition;
