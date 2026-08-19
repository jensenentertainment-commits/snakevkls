import { isRole, type Role } from "../../auth/roles.ts";
import type { CapabilityId } from "./capability";
import type {
  EmployeeDefinition,
  EmployeeId,
} from "./employee-definition";

export type WorkforceAuthorizationRequest = {
  readonly userId: string;
  readonly userRole: string;
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
      readonly userId: string;
      readonly userRole: Role;
      readonly employeeId: EmployeeId;
      readonly capabilityId: CapabilityId;
    }
  | {
      readonly allowed: false;
      readonly reason: WorkforceAuthorizationDenialReason;
    };

const workforcePolicy: Record<
  EmployeeId,
  Record<Role, readonly CapabilityId[]>
> = {
  borre: {
    admin: ["warehouse.read_summary"],
    user: ["warehouse.read_summary"],
    warehouse: ["warehouse.read_summary"],
  },
  arne: {
    admin: ["snake.assess_development"],
    user: [],
    warehouse: [],
  },
  roy: {
    admin: ["shopify.read_catalog"],
    user: ["shopify.read_catalog"],
    warehouse: [],
  },
};

export function evaluateWorkforceAuthorization(
  request: WorkforceAuthorizationRequest,
  employeeDefinition: EmployeeDefinition | null
): WorkforceAuthorizationResult {
  if (
    !employeeDefinition ||
    employeeDefinition.id !== request.employeeId
  ) {
    return { allowed: false, reason: "unknown_employee" };
  }

  const declaredCapability = employeeDefinition.capabilityIds.find(
    (capabilityId) => capabilityId === request.capabilityId
  );

  if (!declaredCapability) {
    return { allowed: false, reason: "undeclared_capability" };
  }

  if (
    !isRole(request.userRole) ||
    !workforcePolicy[employeeDefinition.id][request.userRole].includes(
      declaredCapability
    )
  ) {
    return { allowed: false, reason: "policy_denied" };
  }

  return {
    allowed: true,
    userId: request.userId,
    userRole: request.userRole,
    employeeId: employeeDefinition.id,
    capabilityId: declaredCapability,
  };
}
