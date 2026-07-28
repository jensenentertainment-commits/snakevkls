export const VIPER_ORDER_STATUSES = [
  "received",
  "ready_to_pick",
  "picking",
  "picked",
  "cancelled",
] as const;

export const VIPER_PICK_JOB_STATUSES = [
  "ready",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const VIPER_PICK_LINE_STATUSES = [
  "pending",
  "picked",
  "cancelled",
] as const;

export const VIPER_EVENT_TYPES = [
  "order_imported",
  "pick_job_created",
  "pick_started",
  "pick_line_completed",
  "pick_completed",
] as const;

export type ViperOrderStatus = (typeof VIPER_ORDER_STATUSES)[number];
export type ViperPickJobStatus = (typeof VIPER_PICK_JOB_STATUSES)[number];
export type ViperPickLineStatus = (typeof VIPER_PICK_LINE_STATUSES)[number];
export type ViperEventType = (typeof VIPER_EVENT_TYPES)[number];

export function isViperOrderStatus(value: unknown): value is ViperOrderStatus {
  return (
    typeof value === "string" &&
    VIPER_ORDER_STATUSES.includes(value as ViperOrderStatus)
  );
}

export function isViperPickJobStatus(
  value: unknown
): value is ViperPickJobStatus {
  return (
    typeof value === "string" &&
    VIPER_PICK_JOB_STATUSES.includes(value as ViperPickJobStatus)
  );
}

export function isViperPickLineStatus(
  value: unknown
): value is ViperPickLineStatus {
  return (
    typeof value === "string" &&
    VIPER_PICK_LINE_STATUSES.includes(value as ViperPickLineStatus)
  );
}

export type ViperEventPayload = Readonly<Record<string, unknown>>;

export type ViperEvent = {
  id: string;
  eventSequence: number;
  eventType: ViperEventType | string;
  occurredAt: string;
  orderId: string | null;
  orderLineId: string | null;
  pickJobId: string | null;
  pickLineId: string | null;
  actorId: string | null;
  actorType: "user" | "system" | "shopify";
  correlationId: string;
  causationId: string | null;
  source: string;
  schemaVersion: number;
  payload: ViperEventPayload;
};
