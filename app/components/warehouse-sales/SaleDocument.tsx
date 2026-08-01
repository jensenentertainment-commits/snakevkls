"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, StatusBadge } from "@/app/components/design-system";
import {
  warehouseSalesApiAdapter,
  type WarehouseSaleDocument as SaleDocumentType,
} from "@/lib/warehouse-sales/ui-adapter";

import { formatMoney, formatSaleTime } from "./format";

export function SaleDocument({ id }: { id: string }) {
  const [sale, setSale] = useState<SaleDocumentType | null | undefined>(
    undefined,
  );
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    void warehouseSalesApiAdapter
      .getSale(id)
      .then((result) => {
        if (active) setSale(result);
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setSale(null);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (sale === undefined) {
    return <p aria-live="polite">Laster bilag…</p>;
  }
  if (sale === null) {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-snake-text-primary">
          {loadError ? "Kunne ikke hente bilaget" : "Bilaget finnes ikke"}
        </h1>
        <Link className="mt-4 inline-block text-snake-link" href="/warehouse-sales/history">
          Tilbake til salgshistorikk
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-snake-control px-2 font-semibold text-snake-text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark"
        href="/warehouse-sales/history"
      >
        <ArrowLeft aria-hidden="true" size={18} />
        Salgshistorikk
      </Link>
      <Card className="p-5 sm:p-8">
        <header className="flex flex-col gap-4 border-b border-snake-border-default pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-snake-control bg-snake-info-surface text-snake-info">
              <FileText aria-hidden="true" size={24} />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-snake-text-muted">
              Internt salgsbilag
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-snake-text-primary">
              {sale.saleNumber}
            </h1>
          </div>
          <div className="sm:text-right">
            <StatusBadge label="Betalingsmåte: Vipps" tone="info" />
            <p className="mt-3 text-sm text-snake-text-secondary">
              {formatSaleTime(sale.completedAt)}
            </p>
            <p className="mt-1 text-sm text-snake-text-secondary">
              Registrert av {sale.completedByName}
            </p>
          </div>
        </header>

        <p className="mt-5 rounded-snake-control bg-snake-neutral-surface p-3 text-sm text-snake-text-secondary">
          Dette er et internt bilag for registrert lagersalg, ikke en
          kundekvittering.
        </p>

        <div className="mt-6 space-y-4">
          {sale.lines.map((line, index) => (
            <div
              className="grid gap-2 border-b border-snake-border-subtle pb-4 sm:grid-cols-[1fr_auto_auto]"
              key={`${line.sku ?? line.productName}-${index}`}
            >
              <div>
                <h2 className="font-semibold text-snake-text-primary">
                  {line.productName}
                </h2>
                <p className="text-sm text-snake-text-secondary">
                  {[line.variantName, line.sku].filter(Boolean).join(" · ")}
                </p>
              </div>
              <p className="text-sm text-snake-text-secondary sm:text-right">
                {line.quantity} × {formatMoney(line.unitPriceMinor)}
              </p>
              <strong className="text-snake-text-primary sm:min-w-28 sm:text-right">
                {formatMoney(line.lineTotalMinor)}
              </strong>
            </div>
          ))}
        </div>

        <footer className="mt-6 flex items-baseline justify-between gap-4">
          <span className="text-sm text-snake-text-secondary">
            {sale.itemCount} varer totalt
          </span>
          <div className="text-right">
            <p className="text-sm text-snake-text-secondary">Totalsum</p>
            <strong className="text-2xl text-snake-text-primary">
              {formatMoney(sale.totalMinor)}
            </strong>
          </div>
        </footer>
      </Card>
    </div>
  );
}
