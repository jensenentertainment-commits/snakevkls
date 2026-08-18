import "server-only";

import type {
  EmployeeDefinition,
  EmployeeId,
} from "./employee-definition";
import { borreDefinition } from "./employees/borre";

const employeeRegistry = {
  borre: borreDefinition,
} as const satisfies Record<EmployeeId, EmployeeDefinition>;

export function getEmployeeDefinition(
  employeeId: string
): EmployeeDefinition | null {
  if (!Object.hasOwn(employeeRegistry, employeeId)) return null;

  return employeeRegistry[employeeId as EmployeeId];
}
