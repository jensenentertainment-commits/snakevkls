import { getWarehouseHealth } from "../../snake-intelligence.ts";

export type WarehouseSummaryStats = {
  readonly missingLocationCount: number;
  readonly missingSkuCount: number;
  readonly emptyLocationCount: number;
  readonly quantityDiffCount: number;
  readonly placedProductCount: number;
  readonly activeProductCount: number;
  readonly locationsNoZoneCount: number;
  readonly latestShopifySync: {
    readonly id?: string | null;
    readonly title?: string | null;
    readonly action?: string | null;
    readonly created_at?: string | null;
    readonly metadata?: {
      readonly duration_ms?: number;
      readonly imported?: number;
      readonly skipped_no_sku?: number;
      readonly collections_linked?: number;
      readonly source?: string;
    } | null;
  } | null;
};

export type WarehouseSummaryInventoryRow = {
  readonly product_id: string | null;
  readonly quantity: number | null;
};

export type WarehouseSummaryProductRow = {
  readonly id: string;
  readonly product_name: string | null;
  readonly sku: string | null;
};

export type WarehouseSummaryContext = {
  readonly snakeKnowledge: string;
  readonly page: string | null;
  readonly warehouse: {
    readonly activeProducts: number;
    readonly placedProducts: number;
    readonly quantityDiffs: number;
    readonly missingLocations: number;
    readonly missingSku: number;
    readonly emptyLocations: number;
    readonly locationsWithoutZone: number;
  };
  readonly health: ReturnType<typeof getWarehouseHealth>;
  readonly recommendedAction: string;
  readonly shopifySync: {
    readonly id: string | null;
    readonly status: string | null;
    readonly title: string | null;
    readonly createdAt: string | null;
    readonly imported: number | null;
    readonly skippedNoSku: number | null;
    readonly collectionsLinked: number | null;
    readonly durationMs: number | null;
    readonly source: string | null;
  } | null;
  readonly missingLocationProducts: readonly {
    readonly productName: string;
    readonly sku: string | null;
    readonly quantity: number;
  }[];
};

export function createWarehouseSummaryContext(input: {
  readonly snakeKnowledge: string;
  readonly page: string | null;
  readonly stats: WarehouseSummaryStats;
  readonly missingInventoryRows: readonly WarehouseSummaryInventoryRow[];
  readonly products: readonly WarehouseSummaryProductRow[];
}): WarehouseSummaryContext {
  const { stats } = input;
  const health = getWarehouseHealth({
    missingLocationCount: stats.missingLocationCount,
    quantityDiffCount: stats.quantityDiffCount,
    locationsWithoutZoneCount: stats.locationsNoZoneCount,
    placedCount: stats.placedProductCount,
  });
  const metadata = stats.latestShopifySync?.metadata ?? {};

  return {
    snakeKnowledge: input.snakeKnowledge,
    page: input.page,
    warehouse: {
      activeProducts: stats.activeProductCount,
      placedProducts: stats.placedProductCount,
      quantityDiffs: stats.quantityDiffCount,
      missingLocations: stats.missingLocationCount,
      missingSku: stats.missingSkuCount,
      emptyLocations: stats.emptyLocationCount,
      locationsWithoutZone: stats.locationsNoZoneCount,
    },
    health,
    recommendedAction: getRecommendedWarehouseAction(stats),
    shopifySync: stats.latestShopifySync
      ? {
          id: stats.latestShopifySync.id ?? null,
          status: stats.latestShopifySync.action ?? null,
          title: stats.latestShopifySync.title ?? null,
          createdAt: stats.latestShopifySync.created_at ?? null,
          imported: metadata.imported ?? null,
          skippedNoSku: metadata.skipped_no_sku ?? null,
          collectionsLinked: metadata.collections_linked ?? null,
          durationMs: metadata.duration_ms ?? null,
          source: metadata.source ?? null,
        }
      : null,
    missingLocationProducts: input.missingInventoryRows.map((item) => {
      const product = input.products.find(
        (candidate) => candidate.id === item.product_id
      );

      return {
        productName: product?.product_name ?? "Ukjent produkt",
        sku: product?.sku ?? null,
        quantity: item.quantity ?? 0,
      };
    }),
  };
}

function getRecommendedWarehouseAction(stats: WarehouseSummaryStats) {
  if (stats.quantityDiffCount > 0) {
    return `Rydd quantity diff først (${stats.quantityDiffCount} produkter).`;
  }
  if (stats.missingLocationCount > 0) {
    return `Sett lokasjon på produkter uten plassering (${stats.missingLocationCount} produkter).`;
  }
  if (stats.locationsNoZoneCount > 0) {
    return `Rydd lokasjoner uten sone (${stats.locationsNoZoneCount}).`;
  }
  if (stats.missingSkuCount > 0) {
    return `Rydd produkter uten SKU (${stats.missingSkuCount}).`;
  }
  if (stats.emptyLocationCount > 0) {
    return `Kontroller tomme lokasjoner (${stats.emptyLocationCount}).`;
  }

  return "Ingen kritiske lageroppgaver akkurat nå.";
}
