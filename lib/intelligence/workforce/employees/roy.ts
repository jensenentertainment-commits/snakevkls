import { getRoySystemPrompt } from "@/lib/intelligence/roy/system";
import { BORRE_ROY_MODEL } from "@/lib/intelligence/shared/chat-server";
import { shopifyReadCatalogCapability } from "../capabilities/shopify-read-catalog";
import type { EmployeeDefinition } from "../employee-definition";

export const royDefinition = {
  id: "roy",
  displayName: "Roy",
  role: "Varekompaniets Shopify- og produktspesialist",
  capabilityIds: [shopifyReadCatalogCapability.id],
  model: { id: BORRE_ROY_MODEL },
  getSystemPrompt: getRoySystemPrompt,
} as const satisfies EmployeeDefinition;
