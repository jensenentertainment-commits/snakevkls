"use client";

import { ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/app/components/design-system";

import { formatMoney } from "./format";
import { ProductSearch } from "./ProductSearch";
import { SaleCart } from "./SaleCart";
import { useWarehouseSales } from "./WarehouseSalesProvider";

export function WarehouseSaleWorkspace() {
  const [cartOpen, setCartOpen] = useState(false);
  const { quote } = useWarehouseSales();

  useEffect(() => {
    if (!cartOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCartOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cartOpen]);

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)] lg:pb-0">
      <div className="rounded-snake-panel bg-snake-surface p-4 shadow-snake-panel sm:p-6">
        <ProductSearch />
      </div>
      <aside className="hidden self-start rounded-snake-panel bg-snake-surface p-5 shadow-snake-panel lg:sticky lg:top-6 lg:block">
        <SaleCart compact />
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-snake-border-default bg-snake-surface p-3 shadow-snake-overlay lg:hidden">
        <Button
          aria-expanded={cartOpen}
          aria-haspopup="dialog"
          className="w-full justify-between"
          onClick={() => setCartOpen(true)}
          size="lg"
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingCart aria-hidden="true" size={20} />
            Kurv · {quote.itemCount}
          </span>
          <span>{formatMoney(quote.totalMinor)}</span>
        </Button>
      </div>

      {cartOpen ? (
        <div
          aria-label="Handlekurv"
          aria-modal="true"
          className="fixed inset-0 z-40 bg-[var(--snake-color-overlay)] lg:hidden"
          role="dialog"
        >
          <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-snake-panel bg-snake-surface p-4 shadow-snake-overlay">
            <div className="mb-2 flex justify-end">
              <button
                aria-label="Lukk handlekurv"
                autoFocus
                className="flex h-11 w-11 items-center justify-center rounded-snake-control text-snake-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus"
                onClick={() => setCartOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={22} />
              </button>
            </div>
            <SaleCart />
          </div>
        </div>
      ) : null}
    </div>
  );
}
