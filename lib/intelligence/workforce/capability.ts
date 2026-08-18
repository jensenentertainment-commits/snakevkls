export type CapabilityId = "warehouse.read_summary";

export type DataSourceId =
  | "snake.knowledge"
  | "warehouse.dashboard_stats"
  | "warehouse.missing_location_products";

export type ReadCapabilityDefinition = {
  readonly id: CapabilityId;
  readonly effect: "read";
  readonly dataSourceIds: readonly DataSourceId[];
};
