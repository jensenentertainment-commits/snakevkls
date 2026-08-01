import type {
  CartLineInput,
  CompleteSaleInput,
  WarehouseSaleDocument,
  WarehouseSalesUiAdapter,
} from "./types";
import { WarehouseSalesUiError } from "./types";

type ApiErrorBody = {
  error?: string;
  code?: string;
  failureKind?:
    | "rejected"
    | "inventory_changed"
    | "product_unavailable"
    | "unknown";
};

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (!response.ok) {
    throw new WarehouseSalesUiError(
      body.error ?? "Kunne ikke hente data fra Snake.",
      body.failureKind ?? "rejected",
    );
  }
  return body as T;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof WarehouseSalesUiError) throw error;
    throw new WarehouseSalesUiError(
      "Resultatet er ukjent. Prøv igjen – Snake bruker samme salg og registrerer det ikke dobbelt.",
      "unknown",
    );
  }
}

export const warehouseSalesApiAdapter: WarehouseSalesUiAdapter = {
  async searchProducts(query) {
    const result = await apiFetch<{ products: Awaited<ReturnType<WarehouseSalesUiAdapter["searchProducts"]>> }>(
      `/api/warehouse-sales/products?q=${encodeURIComponent(query)}`,
    );
    return result.products;
  },

  async quoteCart(lines: CartLineInput[]) {
    const result = await apiFetch<{
      quote: Awaited<ReturnType<WarehouseSalesUiAdapter["quoteCart"]>>;
    }>("/api/warehouse-sales/quote", {
      method: "POST",
      body: JSON.stringify({ lines }),
    });
    return result.quote;
  },

  async completeSale(input: CompleteSaleInput) {
    const result = await apiFetch<{ sale: WarehouseSaleDocument }>(
      "/api/warehouse-sales/complete",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    return result.sale;
  },

  async listSales() {
    const result = await apiFetch<{
      sales: Awaited<ReturnType<WarehouseSalesUiAdapter["listSales"]>>;
    }>("/api/warehouse-sales/history");
    return result.sales;
  },

  async getSale(id) {
    const response = await fetch(
      `/api/warehouse-sales/history/${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (response.status === 404) return null;
    const result = await parseResponse<{ sale: WarehouseSaleDocument }>(
      response,
    );
    return result.sale;
  },
};
