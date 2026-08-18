import "server-only";

import { randomUUID } from "node:crypto";
import { getChatOpenAIClient } from "@/lib/intelligence/shared/chat-server";
import type { ValidChatInput } from "@/lib/intelligence/shared/chat-input";
import { authorizeWorkforceRequest } from "./authorize-workforce-request";
import { warehouseReadSummaryCapability } from "./capabilities/warehouse-read-summary";
import { warehouseSummaryProvider } from "./contexts/warehouse-summary-provider";
import { getEmployeeDefinition } from "./registry";
import {
  executeReadOnlyWorkforceRequest,
  type ReadOnlyWorkforceRunResult,
} from "./read-only-execution";
import { logWorkforceRun } from "./runs/logger";

export async function runReadOnlyEmployeeRequest(input: {
  readonly userId: string;
  readonly userRole: string;
  readonly employeeId: "borre";
  readonly capabilityId: "warehouse.read_summary";
  readonly request: ValidChatInput;
}): Promise<ReadOnlyWorkforceRunResult> {
  const runId = randomUUID();
  const authorization = authorizeWorkforceRequest({
    userId: input.userId,
    userRole: input.userRole,
    employeeId: input.employeeId,
    capabilityId: input.capabilityId,
  });
  const employee = getEmployeeDefinition(input.employeeId);

  if (!employee && authorization.allowed) {
    throw new Error("Authorized employee is missing from the registry.");
  }

  return executeReadOnlyWorkforceRequest({
    runId,
    request: {
      employeeId: input.employeeId,
      capabilityId: input.capabilityId,
      input: input.request,
    },
    principal: { userId: input.userId, userRole: input.userRole },
    authorization,
    dependencies: {
      employee,
      capability: warehouseReadSummaryCapability,
      provider: warehouseSummaryProvider,
      createModelResponse: async (request) => {
        const response = await getChatOpenAIClient().responses.create(request);
        return (
          response.output_text ||
          "Børre fikk ikke svart. Det er sjeldent, men tydeligvis mulig."
        );
      },
      logRun: logWorkforceRun,
      now: Date.now,
    },
  });
}
