import "server-only";

import { getDashboardStats } from "@/lib/dashboard";
import { buildSnakeKnowledgePrompt } from "@/lib/intelligence/shared/build-snake-knowledge";
import { createClient } from "@/lib/supabase/server";
import type { ContextProvider } from "../context-provider";
import {
  createWarehouseSummaryContext,
  type WarehouseSummaryContext,
} from "./warehouse-summary";

export const warehouseSummaryProvider = {
  id: "warehouse.summary",
  capabilityId: "warehouse.read_summary",
  async provide(context) {
    const snakeKnowledge = buildSnakeKnowledgePrompt();
    const stats = await getDashboardStats();
    const supabase = await createClient();
    const { data: missingInventoryRows, error: inventoryError } = await supabase
      .from("inventory")
      .select("id, product_id, quantity")
      .is("location_id", null)
      .limit(10);

    if (inventoryError) {
      throw new Error(
        `Missing inventory query failed: ${inventoryError.message}`
      );
    }

    const productIds =
      missingInventoryRows?.map((row) => row.product_id).filter(Boolean) ?? [];
    const { data: products, error: productsError } =
      productIds.length > 0
        ? await supabase
            .from("products")
            .select("id, product_name, sku")
            .in("id", productIds)
        : { data: [], error: null };

    if (productsError) {
      throw new Error(`Missing products query failed: ${productsError.message}`);
    }

    return createWarehouseSummaryContext({
      snakeKnowledge,
      page: context.page,
      stats,
      missingInventoryRows: missingInventoryRows ?? [],
      products: products ?? [],
    });
  },
} satisfies ContextProvider<WarehouseSummaryContext>;
