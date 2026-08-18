import type { Role } from "@/lib/auth/roles";
import type { CapabilityId } from "./capability";
import type { EmployeeId } from "./employee-definition";

export type WorkforceAuthorizationRequest = {
  readonly userId: string;
  readonly userRole: Role;
  readonly employeeId: string;
  readonly capabilityId: string;
};

export type AuthorizedWorkforceContext = {
  readonly userId: string;
  readonly userRole: Role;
  readonly employeeId: EmployeeId;
  readonly capabilityId: CapabilityId;
  readonly runId: string;
  readonly page: string | null;
};

export type WorkforceAuthorizationDenialReason =
  | "unknown_employee"
  | "undeclared_capability"
  | "policy_denied";

export type WorkforceAuthorizationResult =
  | {
      readonly allowed: true;
      readonly employeeId: EmployeeId;
      readonly capabilityId: CapabilityId;
    }
  | {
      readonly allowed: false;
      readonly reason: WorkforceAuthorizationDenialReason;
    };
