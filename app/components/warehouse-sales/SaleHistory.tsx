"use client";

import { ArrowRight, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, StatusBadge } from "@/app/components/design-system";
import {
  warehouseSalesApiAdapter,
  type WarehouseSaleSummary,
} from "@/lib/warehouse-sales/ui-adapter";

import { formatMoney, formatSaleTime } from "./format";
import { ShopifySyncAdmin } from "./ShopifySyncAdmin";

export function SaleHistory() {
  const [sales, setSales] = useState<WarehouseSaleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void warehouseSalesApiAdapter
      .listSales()
      .then((result) => {
        if (active) setSales(result);
      })
      .catch(() => {
        if (active) setError("Kunne ikke hente salgshistorikken.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-snake-panel bg-snake-surface p-4 shadow-snake-panel sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-snake-text-muted">
        Lagersalg
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-snake-text-primary">
        Salgshistorikk
      </h1>
      <p className="mt-2 text-sm text-snake-text-secondary">
        Fullførte lagersalg og interne salgsbilag.
      </p>

      <div className="mt-6">
        <ShopifySyncAdmin />
      </div>

      <div className="grid gap-3">
        {error ? (
          <Card statusTone="danger" variant="status">
            <p role="alert">{error}</p>
          </Card>
        ) : null}
        {sales.map((sale) => (
          <Card
            as="article"
            className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
            key={sale.id}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-snake-control bg-snake-info-surface text-snake-info">
              <ReceiptText aria-hidden="true" size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-snake-text-primary">
                  {sale.saleNumber}
                </h2>
                <StatusBadge label="Vipps" tone="info" />
              </div>
              <p className="mt-1 text-sm text-snake-text-secondary">
                {formatSaleTime(sale.completedAt)} · {sale.itemCount} varer
              </p>
            </div>
            <strong className="text-snake-text-primary">
              {formatMoney(sale.totalMinor)}
            </strong>
            <Link
              aria-label={`Åpne bilag ${sale.saleNumber}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-snake-control px-3 font-semibold text-snake-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus"
              href={`/warehouse-sales/history/${sale.id}`}
            >
              Åpne
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
