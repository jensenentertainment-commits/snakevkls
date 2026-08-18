import { isRole } from "../../auth/roles.ts";
import { buildBorreModelInput } from "../borre/chat-input-builder.ts";
import type { ValidChatInput } from "../shared/chat-input";
import type { ReadCapabilityDefinition } from "./capability";
import type { ContextProvider } from "./context-provider";
import type { WarehouseSummaryContext } from "./contexts/warehouse-summary";
import type { EmployeeDefinition } from "./employee-definition";
import type {
  AuthorizedWorkforceContext,
  WorkforceAuthorizationResult,
} from "./workforce-authorization";
import type {
  WorkforceRunMetadata,
  WorkforceRunOutcome,
} from "./workforce-run-metadata";

type ReadOnlyWorkforceRequest = {
  readonly employeeId: "borre";
  readonly capabilityId: "warehouse.read_summary";
  readonly input: ValidChatInput;
};

export type ReadOnlyExecutionDependencies = {
  readonly employee: EmployeeDefinition | null;
  readonly capability: ReadCapabilityDefinition;
  readonly provider: ContextProvider<WarehouseSummaryContext>;
  readonly createModelResponse: (request: {
    readonly model: string;
    readonly input: ReturnType<typeof buildBorreModelInput>;
  }) => Promise<string>;
  readonly logRun: (metadata: WorkforceRunMetadata) => void;
  readonly now: () => number;
};

export type ReadOnlyWorkforceRunResult =
  | { readonly ok: true; readonly runId: string; readonly answer: string }
  | {
      readonly ok: false;
      readonly runId: string;
      readonly outcome: Exclude<WorkforceRunOutcome, "completed">;
    };

export async function executeReadOnlyWorkforceRequest(input: {
  readonly runId: string;
  readonly request: ReadOnlyWorkforceRequest;
  readonly principal: { readonly userId: string; readonly userRole: string };
  readonly authorization: WorkforceAuthorizationResult;
  readonly dependencies: ReadOnlyExecutionDependencies;
}): Promise<ReadOnlyWorkforceRunResult> {
  const { authorization, dependencies, principal, request, runId } = input;
  const startedAtMs = dependencies.now();
  const finish = (
    outcome: WorkforceRunOutcome,
    details: Pick<
      WorkforceRunMetadata,
      "contextDurationMs" | "modelDurationMs" | "model"
    > = {}
  ) => {
    const completedAtMs = dependencies.now();
    dependencies.logRun({
      runId,
      employeeId: request.employeeId,
      capabilityId: request.capabilityId,
      userId: principal.userId,
      userRole: isRole(principal.userRole) ? principal.userRole : "unknown",
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      outcome,
      dataSourceIds: dependencies.capability.dataSourceIds,
      totalDurationMs: completedAtMs - startedAtMs,
      ...details,
    });
  };

  if (!authorization.allowed) {
    finish("denied");
    return { ok: false, runId, outcome: "denied" };
  }

  const employee = dependencies.employee;
  if (
    !employee ||
    authorization.userId !== principal.userId ||
    authorization.userRole !== principal.userRole ||
    authorization.employeeId !== employee.id ||
    authorization.capabilityId !== dependencies.capability.id ||
    authorization.capabilityId !== dependencies.provider.capabilityId
  ) {
    finish("unexpected_failed");
    return { ok: false, runId, outcome: "unexpected_failed" };
  }

  const authorizedContext: AuthorizedWorkforceContext = {
    runId,
    userId: authorization.userId,
    userRole: authorization.userRole,
    employeeId: authorization.employeeId,
    capabilityId: authorization.capabilityId,
    page: request.input.page,
  };
  const contextStartedAtMs = dependencies.now();
  let context: WarehouseSummaryContext;

  try {
    context = await dependencies.provider.provide(authorizedContext);
  } catch {
    finish("context_failed", {
      contextDurationMs: dependencies.now() - contextStartedAtMs,
    });
    return { ok: false, runId, outcome: "context_failed" };
  }

  const modelStartedAtMs = dependencies.now();
  const contextDurationMs = modelStartedAtMs - contextStartedAtMs;
  try {
    const answer = await dependencies.createModelResponse({
      model: employee.model.id,
      input: buildBorreModelInput({
        systemPrompt: employee.getSystemPrompt(),
        context,
        history: request.input.history,
        question: request.input.question,
      }),
    });
    finish("completed", {
      contextDurationMs,
      modelDurationMs: dependencies.now() - modelStartedAtMs,
      model: employee.model.id,
    });
    return { ok: true, runId, answer };
  } catch {
    finish("model_failed", {
      contextDurationMs,
      modelDurationMs: dependencies.now() - modelStartedAtMs,
      model: employee.model.id,
    });
    return { ok: false, runId, outcome: "model_failed" };
  }
}
