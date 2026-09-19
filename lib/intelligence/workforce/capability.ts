export type CapabilityId =
  | "warehouse.read_summary"
  | "snake.assess_development"
  | "shopify.read_catalog";

export type DataSourceId =
  | "snake.knowledge"
  | "snake.development_context"
  | "snake.latest_activity"
  | "varekompaniet.knowledge"
  | "shopify.catalog_products"
  | "shopify.product_collections"
  | "shopify.canonical_product_content"
  | "shopify.canonical_product_collections"
  | "shopify.catalog_foundation_v1"
  | "warehouse.dashboard_stats"
  | "warehouse.missing_location_products";

export type ReadCapabilityDefinition = {
  readonly id: CapabilityId;
  readonly effect: "read";
  readonly dataSourceIds: readonly DataSourceId[];
};
