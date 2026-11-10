import { describePlacement, type StockData } from "./stock-contract.ts";

/** Existing stock definitions, presented without a physical stock assessment. */
export function buildWorkspaceOverview(data: StockData) {
  const total = data.inventory.reduce((sum, row) => sum + row.quantity, 0);
  const valid = data.inventory.every(row => Number.isSafeInteger(row.quantity) && row.quantity >= 0) && Number.isSafeInteger(total);
  return {
    registeredQuantity: valid ? total : null,
    invalidPlacementRows: valid ? data.inventory.filter(row => describePlacement(data, row).placementIssue !== null).length : null,
  };
}
