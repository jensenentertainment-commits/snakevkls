import type { Role } from "@/lib/auth/roles";
import type { CapabilityId, DataSourceId } from "./capability";
import type { EmployeeId } from "./employee-definition";

export type WorkforceRunOutcome =
  | "completed"
  | "denied"
  | "context_failed"
  | "model_failed"
  | "unexpected_failed";

export type WorkforceRunMetadata = {
  readonly runId: string;
  readonly employeeId: EmployeeId;
  readonly capabilityId: CapabilityId;
  readonly userId: string;
  readonly userRole: Role;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly outcome: WorkforceRunOutcome;
  readonly model?: string;
  readonly dataSourceIds: readonly DataSourceId[];
  readonly contextDurationMs?: number;
  readonly modelDurationMs?: number;
  readonly totalDurationMs?: number;
};
