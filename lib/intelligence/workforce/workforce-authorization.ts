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
      readonly employeeId: EmployeeId;
      readonly capabilityId: CapabilityId;
    }
  | {
      readonly allowed: false;
      readonly reason: WorkforceAuthorizationDenialReason;
    };

const workforcePolicy = {
  borre: {
    admin: ["warehouse.read_summary"],
    lager: ["warehouse.read_summary"],
  },
} as const satisfies Record<
  EmployeeId,
  Record<Role, readonly CapabilityId[]>
>;

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
    employeeId: employeeDefinition.id,
    capabilityId: declaredCapability,
  };
}
