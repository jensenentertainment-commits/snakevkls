import { getRoySystemPrompt } from "@/lib/intelligence/roy/system";
import { shopifyReadCatalogCapability } from "../capabilities/shopify-read-catalog";
import type { EmployeeDefinition } from "../employee-definition";

export const royDefinition = {
  id: "roy",
  displayName: "Roy",
  role: "Varekompaniets Shopify- og produktspesialist",
  capabilityIds: [shopifyReadCatalogCapability.id],
  model: { id: "gpt-5-mini" },
  getSystemPrompt: getRoySystemPrompt,
} as const satisfies EmployeeDefinition;
