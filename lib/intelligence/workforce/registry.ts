import "server-only";

import type {
  EmployeeDefinition,
  EmployeeId,
} from "./employee-definition";
import { borreDefinition } from "./employees/borre";
import { arneDefinition } from "./employees/arne";

const employeeRegistry = {
  borre: borreDefinition,
  arne: arneDefinition,
} as const satisfies Record<EmployeeId, EmployeeDefinition>;

export function getEmployeeDefinition(
  employeeId: string
): EmployeeDefinition | null {
  if (!Object.hasOwn(employeeRegistry, employeeId)) return null;

  return employeeRegistry[employeeId as EmployeeId];
}
