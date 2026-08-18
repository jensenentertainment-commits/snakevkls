import type { CapabilityId } from "./capability";

export type EmployeeId = "borre" | "arne";

export type EmployeeDefinition = {
  readonly id: EmployeeId;
  readonly displayName: string;
  readonly role: string;
  readonly capabilityIds: readonly CapabilityId[];
  readonly model: {
    readonly id: string;
  };
  readonly getSystemPrompt: () => string;
};
