export type ViperQueueItemDto = {
  orderId: string;
  orderNumber: string;
  receivedAt: string;
  pickJobId: string;
  pickStatus: "ready" | "in_progress";
  assignedTo: string | null;
  startedAt: string | null;
  lineCount: number;
  unitCount: number;
};

export type ViperQueueDto = {
  activePick: ViperQueueItemDto | null;
  readyOrders: ViperQueueItemDto[];
};

export type ViperOrderLineDto = {
  id: string;
  sku: string | null;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  expectedQuantity: number;
  locationCode: string;
  sequenceNumber: number;
};

export type ViperOrderDetailDto = {
  orderId: string;
  orderNumber: string;
  receivedAt: string;
  pickJobId: string;
  pickStatus: "ready" | "in_progress";
  assignedTo: string | null;
  startedAt: string | null;
  totalUnits: number;
  lines: ViperOrderLineDto[];
  canStart: boolean;
  isOwnedByActor: boolean;
};

export type StartViperPickDto = {
  orderId: string;
  pickJobId: string;
  status: "in_progress";
  startedAt: string;
  idempotent: boolean;
};
