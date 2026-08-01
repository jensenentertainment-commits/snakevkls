"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  warehouseSalesApiAdapter,
  type CartLineInput,
  type CartQuote,
  type WarehouseSaleDocument,
  type WarehouseSaleProduct,
  WarehouseSalesUiError,
} from "@/lib/warehouse-sales/ui-adapter";

type WarehouseSalesContextValue = {
  quote: CartQuote;
  lastCompletedSale: WarehouseSaleDocument | null;
  addProduct(product: WarehouseSaleProduct): void;
  clearCart(): void;
  completeSale(): Promise<WarehouseSaleDocument>;
  removeLine(productId: string): void;
  setQuantity(productId: string, quantity: number): void;
  setUnitPrice(productId: string, unitPriceMinor: number): void;
  requote(): Promise<CartQuote>;
};

const EMPTY_QUOTE: CartQuote = {
  lines: [],
  itemCount: 0,
  totalMinor: 0,
  canComplete: false,
};

const WarehouseSalesContext =
  createContext<WarehouseSalesContextValue | null>(null);

export function WarehouseSalesProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputs] = useState<CartLineInput[]>([]);
  const [quote, setQuote] = useState<CartQuote>(EMPTY_QUOTE);
  const [lastCompletedSale, setLastCompletedSale] =
    useState<WarehouseSaleDocument | null>(null);
  const operationKeyRef = useRef<string | null>(null);
  const completionPromiseRef =
    useRef<Promise<WarehouseSaleDocument> | null>(null);

  useEffect(() => {
    let active = true;
    void warehouseSalesApiAdapter.quoteCart(inputs).then((nextQuote) => {
      if (active) setQuote(nextQuote);
    }).catch(() => {
      if (active) {
        setQuote((current) => ({ ...current, canComplete: false }));
      }
    });
    return () => {
      active = false;
    };
  }, [inputs]);

  const addProduct = useCallback((product: WarehouseSaleProduct) => {
    if (product.availability.status !== "available") return;
    operationKeyRef.current = null;
    setInputs((current) => {
      const existing = current.find((line) => line.productId === product.id);
      return existing
        ? current.map((line) =>
            line.productId === product.id
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [
            ...current,
            {
              productId: product.id,
              quantity: 1,
              unitPriceMinor: product.suggestedUnitPriceMinor,
            },
          ];
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    operationKeyRef.current = null;
    setInputs((current) =>
      current.filter((line) => line.productId !== productId),
    );
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    operationKeyRef.current = null;
    setInputs((current) =>
      current.map((line) =>
        line.productId === productId ? { ...line, quantity } : line,
      ),
    );
  }, []);

  const setUnitPrice = useCallback(
    (productId: string, unitPriceMinor: number) => {
      operationKeyRef.current = null;
      setInputs((current) =>
        current.map((line) =>
          line.productId === productId ? { ...line, unitPriceMinor } : line,
        ),
      );
    },
    [],
  );

  const clearCart = useCallback(() => {
    setInputs([]);
    setLastCompletedSale(null);
    operationKeyRef.current = null;
  }, []);

  const completeSale = useCallback(async () => {
    if (completionPromiseRef.current) return completionPromiseRef.current;

    operationKeyRef.current ??= crypto.randomUUID();
    const operationKey = operationKeyRef.current;
    const completion = warehouseSalesApiAdapter
      .completeSale({
        idempotencyKey: operationKey,
        lines: inputs,
        paymentMethod: "vipps",
      })
      .then((sale) => {
        setInputs([]);
        setLastCompletedSale(sale);
        operationKeyRef.current = null;
        return sale;
      })
      .catch((error) => {
        if (
          !(error instanceof WarehouseSalesUiError) ||
          error.kind !== "unknown"
        ) {
          operationKeyRef.current = null;
        }
        throw error;
      })
      .finally(() => {
        completionPromiseRef.current = null;
      });
    completionPromiseRef.current = completion;
    return completion;
  }, [inputs]);

  const requote = useCallback(async () => {
    const latestQuote = await warehouseSalesApiAdapter.quoteCart(inputs);
    setQuote(latestQuote);
    return latestQuote;
  }, [inputs]);

  const value = useMemo(
    () => ({
      quote,
      lastCompletedSale,
      addProduct,
      clearCart,
      completeSale,
      removeLine,
      setQuantity,
      setUnitPrice,
      requote,
    }),
    [
      quote,
      lastCompletedSale,
      addProduct,
      clearCart,
      completeSale,
      removeLine,
      setQuantity,
      setUnitPrice,
      requote,
    ],
  );

  return (
    <WarehouseSalesContext.Provider value={value}>
      {children}
    </WarehouseSalesContext.Provider>
  );
}

export function useWarehouseSales() {
  const context = useContext(WarehouseSalesContext);
  if (!context) {
    throw new Error(
      "useWarehouseSales must be used inside WarehouseSalesProvider.",
    );
  }
  return context;
}
