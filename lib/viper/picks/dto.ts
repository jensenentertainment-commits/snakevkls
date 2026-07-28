export type ViperPickExceptionType =
  | "item_not_found"
  | "wrong_quantity"
  | "damaged";

export type ViperPickLineDto = {
  id: string;
  sequenceNumber: number;
  status: "pending" | "picked" | "cancelled";
  productName: string;
  variantName: string | null;
  sku: string | null;
  imageUrl: string | null;
  locationCode: string;
  expectedQuantity: number;
  pickedAt: string | null;
  hasOpenException: boolean;
};

export type ViperActivePickDto = {
  pickJobId: string;
  orderId: string;
  orderNumber: string;
  status: "in_progress" | "completed";
  totalLines: number;
  completedLines: number;
  hasOpenExceptions: boolean;
  lines: ViperPickLineDto[];
};

export type ViperOpenExceptionDto = {
  id: string;
  exceptionType: ViperPickExceptionType;
  note: string | null;
  observedQuantity: number | null;
  reportedAt: string;
  pickLineId: string;
  sequenceNumber: number;
  orderNumber: string;
  productName: string;
  sku: string | null;
};
