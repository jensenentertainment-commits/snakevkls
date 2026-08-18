import { getArneSystemPrompt } from "@/lib/intelligence/arne/system";
import { CHAT_MODEL } from "@/lib/intelligence/shared/chat-server";
import { snakeAssessDevelopmentCapability } from "../capabilities/snake-assess-development";
import type { EmployeeDefinition } from "../employee-definition";

export const arneDefinition = {
  id: "arne",
  displayName: "Arne",
  role: "Snake-ekspert og admins rådgiver for Snake OS",
  capabilityIds: [snakeAssessDevelopmentCapability.id],
  model: {
    id: CHAT_MODEL,
  },
  getSystemPrompt: getArneSystemPrompt,
} as const satisfies EmployeeDefinition;
