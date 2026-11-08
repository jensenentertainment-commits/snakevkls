"use client";

import { Button, Card, StatusBadge } from "@/app/components/design-system";


import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  ShopifyImportApiResponse,
  ShopifyOrderPreview,
  ShopifyPreviewApiResponse,
} from "@/lib/viper/shopify/preview-types";

export default function ShopifyOrderPreviewForm({
  importEnabled,
}: {
  importEnabled: boolean;
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [preview, setPreview] = useState<ShopifyOrderPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderId.trim() || busy) return;
    setBusy(true);
    setError(null);
    setPreview(null);

    try {
      const response = await fetch("/api/viper/shopify/orders/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = (await response.json()) as ShopifyPreviewApiResponse;
      if (!body.ok) {
        setError(body.error);
        return;
      }
      setPreview(body.preview);
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  async function importOrder() {
    if (!preview?.importable || importing) return;
    setImporting(true);
    setError(null);
    try {
      const response = await fetch("/api/viper/shopify/orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: preview.order.id,
          previewUpdatedAt: preview.order.updatedAt,
        }),
      });
      const body = (await response.json()) as ShopifyImportApiResponse;
      if (!body.ok) {
        setError(body.error);
        if (body.code === "PREVIEW_STALE" || body.code === "ORDER_NOT_IMPORTABLE") {
          setPreview(null);
        }
        return;
      }
      router.push(`/viper/orders/${body.result.orderId}`);
      router.refresh();
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="min-w-0">
        <label htmlFor="shopify-order-id" className="text-sm font-semibold">
          Shopify Order ID
        </label>
        <p className="mt-1 text-sm text-snake-text-secondary">
          Lim inn numerisk ID eller full Shopify GID.
        </p>
        <input
          id="shopify-order-id"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          autoComplete="off"
          inputMode="numeric"
          className="mt-3 min-h-12 w-full rounded-snake-control border border-snake-border-default px-4 bg-snake-surface text-snake-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus"
          placeholder="For eksempel 1234567890"
        />
        <Button
          type="submit"
          disabled={!orderId.trim() || busy}
          variant="primary" size="lg" className="h-auto py-3 whitespace-normal mt-3 min-h-12 w-full"
        >
          {busy ? "Kontrollerer …" : "Forhåndsvis ordre"}
        </Button>
        {error && (
          <p role="alert" className="mt-3 rounded-snake-control bg-snake-danger-surface p-3 text-sm font-semibold text-snake-danger">
            {error}
          </p>
        )}
      </form>

      {preview && (
        <section className="space-y-4" aria-live="polite">
          <header
            className={`rounded-snake-card p-5 ${
              preview.importable && importEnabled
                ? "bg-snake-success-surface text-snake-success"
                : "bg-snake-warning-surface text-snake-warning"
            }`}
          >
            <p className="text-sm font-semibold uppercase tracking-wide">
              {preview.importable && importEnabled
                ? "Kan importeres"
                : preview.importable
                  ? "Klar, men import er deaktivert"
                  : "Kan ikke importeres"}
            </p>
            <h2 className="mt-1 text-[length:var(--snake-text-heading-section-size)] font-semibold">{preview.order.name}</h2>
            <p className="mt-1 text-sm">
              Betaling: {preview.order.financialStatus ?? "Ukjent"} · Oppfyllelse:{" "}
              {preview.order.fulfillmentStatus ?? "Ukjent"}
            </p>
          </header>

          {preview.reasons.length > 0 && (
            <div className="rounded-snake-card bg-snake-surface p-5">
              <h3 className="font-semibold [overflow-wrap:anywhere]">Må avklares</h3>
              <ul className="mt-3 space-y-2">
                {preview.reasons.map((item, index) => (
                  <li key={`${item.code}-${item.lineId ?? "order"}-${index}`} className="text-sm">
                    {item.message}{" "}
                    <span className="font-mono text-xs text-snake-text-secondary">({item.code})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {preview.lines.map((line) => (
              <Card as="article" key={line.lineId} className="rounded-snake-card bg-snake-surface p-5 shadow-snake-card">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <div>
                    <h3 className="text-lg font-semibold">{line.title}</h3>
                    <p className="text-sm text-snake-text-secondary">
                      {line.variantTitle ?? "Standardvariant"} · {line.sku ?? "Uten SKU"}
                    </p>
                  </div>
                  <StatusBadge tone={line.importable ? "success" : "warning"} label={line.importable ? "Klar" : "Stopp"} />
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-snake-text-secondary">Antall</dt>
                    <dd className="font-semibold">{line.requestedQuantity}</dd>
                  </div>
                  <div>
                    <dt className="text-snake-text-secondary">Lokasjon</dt>
                    <dd className="font-semibold">{line.locationCode ?? "Ikke valgt"}</dd>
                  </div>
                  <div>
                    <dt className="text-snake-text-secondary">Produkt i Snake</dt>
                    <dd className="font-semibold">{line.productName ?? "Ingen match"}</dd>
                  </div>
                  <div>
                    <dt className="text-snake-text-secondary">Fysisk beholdning</dt>
                    <dd className="font-semibold">{line.availableQuantity ?? "Ukjent"}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>

          {preview.importable && importEnabled ? (
            <div className="sticky bottom-3 rounded-snake-card border border-snake-border-subtle bg-snake-surface/95 p-4 shadow-snake-panel backdrop-blur">
              <Button
                type="button"
                onClick={importOrder}
                disabled={importing}
                variant="primary" size="lg" className="h-auto py-3 whitespace-normal min-h-14 w-full"
              >
                {importing ? "Importerer …" : "Importer til Viper"}
              </Button>
              <p className="mt-2 text-center text-xs text-snake-text-secondary">
                Ordren kontrolleres på nytt før import.
              </p>
            </div>
          ) : preview.importable ? (
            <div className="rounded-snake-card border border-snake-warning-border bg-snake-warning-surface p-4 text-sm font-semibold text-snake-warning">
              Shopify-import til Viper er deaktivert. Forhåndsvisningen er
              fortsatt skrivebeskyttet.
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
