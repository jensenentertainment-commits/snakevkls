import { getBorreChatSystemPrompt } from "@/lib/intelligence/borre/chat-system";
import { CHAT_MODEL } from "@/lib/intelligence/shared/chat-server";
import type { EmployeeDefinition } from "../employee-definition";
import { warehouseReadSummaryCapability } from "../capabilities/warehouse-read-summary";

export const borreDefinition = {
  id: "borre",
  displayName: "Børre",
  role: "Lagerassistent i Snake OS",
  capabilityIds: [warehouseReadSummaryCapability.id],
  model: {
    id: CHAT_MODEL,
  },
  getSystemPrompt: getBorreChatSystemPrompt,
} as const satisfies EmployeeDefinition;
