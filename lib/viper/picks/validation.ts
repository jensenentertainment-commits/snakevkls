import type { ViperPickExceptionType } from "./dto";

export const VIPER_PICK_EXCEPTION_TYPES = [
  "item_not_found",
  "wrong_quantity",
  "damaged",
] as const;

export function isViperPickExceptionType(
  value: unknown
): value is ViperPickExceptionType {
  return (
    typeof value === "string" &&
    VIPER_PICK_EXCEPTION_TYPES.includes(value as ViperPickExceptionType)
  );
}
