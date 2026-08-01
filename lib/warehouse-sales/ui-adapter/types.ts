export type MinorUnits = number;

export type ProductAvailability =
  | { status: "available"; availableQuantity: number }
  | {
      status: "unavailable";
      availableQuantity: number;
      reason: string;
    };

export type WarehouseSaleProduct = {
  id: string;
  sku: string | null;
  productName: string;
  variantName: string | null;
  imageUrl: string;
  suggestedUnitPriceMinor: MinorUnits;
  availability: ProductAvailability;
};

export type CartLineInput = {
  productId: string;
  quantity: number;
  unitPriceMinor: MinorUnits;
};

export type QuotedCartLine = CartLineInput & {
  product: WarehouseSaleProduct;
  standardUnitPriceMinor: MinorUnits;
  priceOverridden: boolean;
  lineTotalMinor: MinorUnits;
  error: string | null;
};

export type CartQuote = {
  lines: QuotedCartLine[];
  itemCount: number;
  totalMinor: MinorUnits;
  canComplete: boolean;
};

export type CompleteSaleInput = {
  idempotencyKey: string;
  paymentMethod: "vipps";
  lines: CartLineInput[];
};

export type WarehouseSaleDocument = {
  id: string;
  saleNumber: string;
  completedAt: string;
  paymentMethod: "vipps";
  completedByName: string;
  lines: Array<{
    productName: string;
    variantName: string | null;
    sku: string | null;
    quantity: number;
    unitPriceMinor: MinorUnits;
    lineTotalMinor: MinorUnits;
  }>;
  itemCount: number;
  totalMinor: MinorUnits;
};

export type WarehouseSaleSummary = Pick<
  WarehouseSaleDocument,
  "id" | "saleNumber" | "completedAt" | "itemCount" | "totalMinor"
>;

export interface WarehouseSalesUiAdapter {
  searchProducts(query: string): Promise<WarehouseSaleProduct[]>;
  quoteCart(lines: CartLineInput[]): Promise<CartQuote>;
  completeSale(input: CompleteSaleInput): Promise<WarehouseSaleDocument>;
  listSales(): Promise<WarehouseSaleSummary[]>;
  getSale(id: string): Promise<WarehouseSaleDocument | null>;
}

export type WarehouseSaleFailureKind =
  | "rejected"
  | "inventory_changed"
  | "product_unavailable"
  | "unknown";

export class WarehouseSalesUiError extends Error {
  constructor(
    message: string,
    public readonly kind: WarehouseSaleFailureKind,
  ) {
    super(message);
  }
}
