"use client";

import Link from "next/link";
import { CheckCircle2, Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, Card } from "@/app/components/design-system";

import { formatMoney, parseMoneyToMinor } from "./format";
import { useWarehouseSales } from "./WarehouseSalesProvider";
import { WarehouseSalesUiError } from "@/lib/warehouse-sales/ui-adapter";

export function SaleCart({ compact = false }: { compact?: boolean }) {
  const {
    quote,
    paymentMethod,
    clearCart,
    completeSale,
    removeLine,
    setQuantity,
    setPaymentMethod,
    setUnitPrice,
    requote,
  } = useWarehouseSales();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const latestQuote = await requote();
      if (!latestQuote.canComplete) {
        setError(
          "Kurven er endret siden sist. Kontroller beholdning og varer før du prøver igjen.",
        );
        setConfirming(false);
        return;
      }
      const sale = await completeSale();
      setCompletedId(sale.id);
      setConfirming(false);
    } catch (caught) {
      if (caught instanceof WarehouseSalesUiError) {
        setError(caught.message);
        if (
          caught.kind === "inventory_changed" ||
          caught.kind === "product_unavailable"
        ) {
          setConfirming(false);
        }
      } else {
        setError("Kunne ikke fullføre salget.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (completedId) {
    return (
      <Card className="border-snake-success-border bg-snake-success-surface">
        <CheckCircle2 aria-hidden="true" className="text-snake-success" />
        <h2 className="mt-3 text-xl font-semibold text-snake-text-primary">
          Salget er fullført
        </h2>
        <p className="mt-2 text-sm text-snake-text-secondary">
          Salget er lagret i Snake. Lageroppdateringen til Shopify behandles i
          bakgrunnen.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button href={`/warehouse-sales/history/${completedId}`}>
            Åpne internt bilag
          </Button>
          <Button
            onClick={() => setCompletedId(null)}
            variant="secondary"
          >
            Nytt salg
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <section aria-labelledby="sale-cart-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-snake-text-muted">
            Aktivt salg
          </p>
          <h2
            className="mt-1 text-2xl font-semibold text-snake-text-primary"
            id="sale-cart-title"
          >
            Handlekurv
          </h2>
        </div>
        {quote.lines.length ? (
          <Button onClick={clearCart} size="sm" variant="ghost">
            <Trash2 aria-hidden="true" size={16} />
            Tøm
          </Button>
        ) : null}
      </div>

      {!quote.lines.length ? (
        <Card className="mt-4 text-center" variant="subtle">
          <p className="font-medium text-snake-text-primary">Kurven er tom</p>
          <p className="mt-1 text-sm text-snake-text-secondary">
            Trykk på en vare for å legge den til.
          </p>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {quote.lines.map((line) => (
            <Card
              as="article"
              className="p-4"
              key={line.productId}
              variant={line.error ? "status" : "subtle"}
              statusTone={line.error ? "danger" : "neutral"}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-snake-text-primary">
                    {line.product.productName}
                  </h3>
                  {line.product.variantName ? (
                    <p className="text-sm text-snake-text-secondary">
                      {line.product.variantName}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label={`Fjern ${line.product.productName}`}
                  className="h-11 w-11 rounded-snake-control text-snake-text-muted hover:bg-snake-neutral-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus"
                  onClick={() => removeLine(line.productId)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="mx-auto" size={18} />
                </button>
              </div>

              <div
                className={`mt-4 grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}
              >
                <fieldset>
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-snake-text-muted">
                    Antall
                  </legend>
                  <div className="flex items-center">
                    <button
                      aria-label={`Reduser antall ${line.product.productName}`}
                      className="h-11 w-11 rounded-l-snake-control border border-snake-border-default bg-snake-surface text-snake-text-primary focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus"
                      onClick={() =>
                        setQuantity(line.productId, line.quantity - 1)
                      }
                      type="button"
                    >
                      <Minus aria-hidden="true" className="mx-auto" size={17} />
                    </button>
                    <output
                      aria-label="Antall"
                      className="flex h-11 min-w-12 items-center justify-center border-y border-snake-border-default bg-snake-surface font-semibold text-snake-text-primary"
                    >
                      {line.quantity}
                    </output>
                    <button
                      aria-label={`Øk antall ${line.product.productName}`}
                      className="h-11 w-11 rounded-r-snake-control border border-snake-border-default bg-snake-surface text-snake-text-primary focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus"
                      onClick={() =>
                        setQuantity(line.productId, line.quantity + 1)
                      }
                      type="button"
                    >
                      <Plus aria-hidden="true" className="mx-auto" size={17} />
                    </button>
                  </div>
                </fieldset>
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-snake-text-muted">
                    Enhetspris
                  </span>
                  <span className="relative block">
                    <input
                      aria-describedby={
                        line.error ? `${line.productId}-error` : undefined
                      }
                      className="h-11 w-full rounded-snake-control border border-snake-border-default bg-snake-surface px-3 pr-10 text-right text-snake-text-primary focus:border-snake-focus focus:outline-none focus:ring-2 focus:ring-snake-focus-soft"
                      defaultValue={(line.unitPriceMinor / 100)
                        .toFixed(2)
                        .replace(".", ",")}
                      inputMode="decimal"
                      onBlur={(event) =>
                        setUnitPrice(
                          line.productId,
                          parseMoneyToMinor(event.target.value),
                        )
                      }
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-snake-text-muted">
                      kr
                    </span>
                  </span>
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {line.error ? (
                  <p
                    className="text-sm font-medium text-snake-danger"
                    id={`${line.productId}-error`}
                    role="alert"
                  >
                    {line.error}
                  </p>
                ) : (
                  <span />
                )}
                <strong className="text-snake-text-primary">
                  {formatMoney(line.lineTotalMinor)}
                </strong>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-snake-border-default pt-5">
        <fieldset>
          <legend className="text-sm font-semibold text-snake-text-primary">
            Betalingsmåte
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              ["vipps", "Vipps"],
              ["cash", "Kontant"],
            ] as const).map(([value, label]) => (
              <label
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-snake-control border px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-snake-focus ${
                  paymentMethod === value
                    ? "border-snake-info bg-snake-info-surface text-snake-info"
                    : "border-snake-border-default bg-snake-surface text-snake-text-secondary"
                }`}
                key={value}
              >
                <input
                  checked={paymentMethod === value}
                  className="sr-only"
                  name="warehouse-sale-payment-method"
                  onChange={() => setPaymentMethod(value)}
                  type="radio"
                  value={value}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 flex items-baseline justify-between gap-4">
          <span className="text-sm text-snake-text-secondary">
            {quote.itemCount} {quote.itemCount === 1 ? "vare" : "varer"}
          </span>
          <strong
            aria-live="polite"
            className="text-2xl text-snake-text-primary"
          >
            {formatMoney(quote.totalMinor)}
          </strong>
        </div>

        {confirming ? (
          <Card className="mt-4" statusTone="warning" variant="status">
            <h3 className="font-semibold text-snake-text-primary">
              Kontroller betalingen
            </h3>
            <p className="mt-2 text-sm text-snake-text-secondary">
              {paymentMethod === "vipps"
                ? "Kontroller at beløpet er mottatt på Vipps før salget fullføres."
                : "Kontroller at beløpet er mottatt kontant før salget fullføres."}{" "}
              Snake registrerer ikke selve betalingen.
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                loading={busy}
                loadingLabel="Fullfører lokalt salg"
                onClick={handleComplete}
              >
                Betaling kontrollert – fullfør
              </Button>
              <Button
                disabled={busy}
                onClick={() => setConfirming(false)}
                variant="secondary"
              >
                Tilbake
              </Button>
            </div>
          </Card>
        ) : (
          <Button
            className="mt-4 w-full"
            disabled={!quote.canComplete}
            onClick={() => setConfirming(true)}
            size="lg"
          >
            Kontroller og fullfør
          </Button>
        )}
        {error ? (
          <p className="mt-3 text-sm text-snake-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Link
          className="mt-4 block text-center text-sm font-semibold text-snake-link underline-offset-4 hover:underline"
          href="/warehouse-sales/history"
        >
          Se salgshistorikk
        </Link>
      </div>
    </section>
  );
}
