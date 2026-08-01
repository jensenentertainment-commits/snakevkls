"use client";

import Image from "next/image";
import { Search, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Card, StatusBadge } from "@/app/components/design-system";
import {
  warehouseSalesApiAdapter,
  type WarehouseSaleProduct,
} from "@/lib/warehouse-sales/ui-adapter";

import { formatMoney } from "./format";
import { useWarehouseSales } from "./WarehouseSalesProvider";

export function ProductSearch() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<WarehouseSaleProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { addProduct } = useWarehouseSales();

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void warehouseSalesApiAdapter
        .searchProducts(query)
        .then((results) => {
          if (active) setProducts(results);
          if (active) setLoading(false);
        })
        .catch(() => {
          if (active) {
            setProducts([]);
            setLoading(false);
            setError("Kunne ikke hente produkter akkurat nå.");
          }
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <section aria-labelledby="product-search-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-snake-text-muted">
          Finn vare
        </p>
        <h1
          className="mt-2 text-3xl font-semibold text-snake-text-primary"
          id="product-search-title"
        >
          Lagersalg
        </h1>
        <p className="mt-2 text-sm text-snake-text-secondary">
          Søk på produktnavn eller variant. SKU fungerer også.
        </p>
      </div>

      <label className="relative mt-5 block">
        <span className="sr-only">Søk etter produkt</span>
        <Search
          aria-hidden="true"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-snake-text-muted"
          size={20}
        />
        <input
          autoComplete="off"
          autoFocus
          className="h-14 w-full rounded-snake-action border border-snake-border-default bg-snake-surface pl-12 pr-4 text-base text-snake-text-primary outline-none transition focus:border-snake-focus focus:ring-2 focus:ring-snake-focus-soft"
          onChange={(event) => {
            setQuery(event.target.value);
            setLoading(true);
            setError(null);
          }}
          placeholder="Søk etter produkt…"
          type="search"
          value={query}
        />
      </label>

      <p aria-live="polite" className="mt-3 text-sm text-snake-text-muted">
        {loading
          ? "Søker…"
          : `${products.length} ${
              products.length === 1 ? "produkt" : "produkter"
            }`}
      </p>
      {error ? (
        <p className="mt-2 text-sm font-medium text-snake-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {products.map((product) => {
          const available = product.availability.status === "available";
          return (
            <Card
              as="article"
              className="flex min-h-32 items-center gap-4 p-3 sm:p-4"
              key={product.id}
              variant={available ? "default" : "disabled"}
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-snake-control bg-snake-neutral-surface">
                <Image
                  alt=""
                  className="object-contain p-2"
                  fill
                  sizes="80px"
                  src={product.imageUrl}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold leading-5 text-snake-text-primary">
                  {product.productName}
                </h2>
                {product.variantName ? (
                  <p className="mt-1 text-sm text-snake-text-secondary">
                    {product.variantName}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-snake-text-primary">
                    {formatMoney(product.suggestedUnitPriceMinor)}
                  </span>
                  {product.availability.status === "available" ? (
                    <StatusBadge
                      label={`${product.availability.availableQuantity} på lager`}
                      tone="success"
                    />
                  ) : (
                    <StatusBadge
                      label={product.availability.reason}
                      tone="neutral"
                    />
                  )}
                </div>
              </div>
              <Button
                aria-label={`Legg til ${product.productName}`}
                className="h-12 w-12 px-0"
                disabled={!available}
                onClick={() => addProduct(product)}
                size="md"
              >
                <ShoppingCart aria-hidden="true" size={20} />
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
