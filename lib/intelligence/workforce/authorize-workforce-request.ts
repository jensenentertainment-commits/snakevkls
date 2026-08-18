import "server-only";

import { getEmployeeDefinition } from "./registry";
import {
  evaluateWorkforceAuthorization,
  type WorkforceAuthorizationRequest,
  type WorkforceAuthorizationResult,
} from "./workforce-authorization";

export function authorizeWorkforceRequest(
  request: WorkforceAuthorizationRequest
): WorkforceAuthorizationResult {
  return evaluateWorkforceAuthorization(
    request,
    getEmployeeDefinition(request.employeeId)
  );
}
