import "server-only";

import { randomUUID } from "node:crypto";
import { buildArneModelInput } from "@/lib/intelligence/arne/chat-input-builder";
import { buildBorreModelInput } from "@/lib/intelligence/borre/chat-input-builder";
import type { ValidChatInput } from "@/lib/intelligence/shared/chat-input";
import { getChatOpenAIClient } from "@/lib/intelligence/shared/chat-server";
import { authorizeWorkforceRequest } from "./authorize-workforce-request";
import { snakeAssessDevelopmentCapability } from "./capabilities/snake-assess-development";
import { warehouseReadSummaryCapability } from "./capabilities/warehouse-read-summary";
import { arneAdvisoryContextProvider } from "./contexts/arne-advisory-context-provider";
import { warehouseSummaryProvider } from "./contexts/warehouse-summary-provider";
import { getEmployeeDefinition } from "./registry";
import {
  executeReadOnlyWorkforceRequest,
  type ReadOnlyWorkforceRequest,
  type ReadOnlyWorkforceRunResult,
} from "./read-only-execution";
import { logWorkforceRun } from "./runs/logger";

type RuntimeRequest = (
  | {
      readonly employeeId: "borre";
      readonly capabilityId: "warehouse.read_summary";
    }
  | {
      readonly employeeId: "arne";
      readonly capabilityId: "snake.assess_development";
    }
) & {
  readonly userId: string;
  readonly userRole: string;
  readonly request: ValidChatInput;
};

export async function runReadOnlyEmployeeRequest(
  input: RuntimeRequest
): Promise<ReadOnlyWorkforceRunResult> {
  const runId = randomUUID();
  const authorization = authorizeWorkforceRequest({
    userId: input.userId,
    userRole: input.userRole,
    employeeId: input.employeeId,
    capabilityId: input.capabilityId,
  });
  const employee = getEmployeeDefinition(input.employeeId);
  const request: ReadOnlyWorkforceRequest =
    input.employeeId === "borre"
      ? {
          employeeId: input.employeeId,
          capabilityId: input.capabilityId,
          input: input.request,
        }
      : {
          employeeId: input.employeeId,
          capabilityId: input.capabilityId,
          input: input.request,
        };
  const shared = {
    runId,
    request,
    principal: { userId: input.userId, userRole: input.userRole },
    authorization,
  };

  if (input.employeeId === "borre") {
    return executeReadOnlyWorkforceRequest({
      ...shared,
      dependencies: {
        employee,
        capability: warehouseReadSummaryCapability,
        provider: warehouseSummaryProvider,
        buildModelInput: buildBorreModelInput,
        createModelResponse: createModelResponse(
          "Børre fikk ikke svart. Det er sjeldent, men tydeligvis mulig."
        ),
        logRun: logWorkforceRun,
        now: Date.now,
      },
    });
  }

  return executeReadOnlyWorkforceRequest({
    ...shared,
    dependencies: {
      employee,
      capability: snakeAssessDevelopmentCapability,
      provider: arneAdvisoryContextProvider,
      buildModelInput: buildArneModelInput,
      createModelResponse: createModelResponse(
        "Arne fikk ikke svart. Det er irriterende, men teknisk mulig."
      ),
      logRun: logWorkforceRun,
      now: Date.now,
    },
  });
}

function createModelResponse(fallback: string) {
  return async (request: {
    readonly model: string;
    readonly input: Array<{
      readonly role: "system" | "user" | "assistant";
      readonly content: string;
    }>;
  }) => {
    const response = await getChatOpenAIClient().responses.create(request);
    return response.output_text || fallback;
  };
}
