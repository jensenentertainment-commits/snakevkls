export type CapabilityId =
  | "warehouse.read_summary"
  | "snake.assess_development";

export type DataSourceId =
  | "snake.knowledge"
  | "snake.development_context"
  | "snake.latest_activity"
  | "warehouse.dashboard_stats"
  | "warehouse.missing_location_products";

export type ReadCapabilityDefinition = {
  readonly id: CapabilityId;
  readonly effect: "read";
  readonly dataSourceIds: readonly DataSourceId[];
};
