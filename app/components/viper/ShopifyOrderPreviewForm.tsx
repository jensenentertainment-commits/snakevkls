"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  ShopifyImportApiResponse,
  ShopifyOrderPreview,
  ShopifyPreviewApiResponse,
} from "@/lib/viper/shopify/preview-types";

export default function ShopifyOrderPreviewForm() {
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
      <form onSubmit={submit} className="rounded-3xl bg-white p-5 shadow-sm">
        <label htmlFor="shopify-order-id" className="text-sm font-bold">
          Shopify Order ID
        </label>
        <p className="mt-1 text-sm text-neutral-500">
          Lim inn numerisk ID eller full Shopify GID.
        </p>
        <input
          id="shopify-order-id"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          autoComplete="off"
          inputMode="numeric"
          className="mt-3 min-h-12 w-full rounded-xl border border-neutral-300 px-4"
          placeholder="For eksempel 1234567890"
        />
        <button
          type="submit"
          disabled={!orderId.trim() || busy}
          className="mt-3 min-h-12 w-full rounded-xl bg-[#055a7d] px-5 font-bold text-white disabled:opacity-50"
        >
          {busy ? "Kontrollerer …" : "Forhåndsvis ordre"}
        </button>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
            {error}
          </p>
        )}
      </form>

      {preview && (
        <section className="space-y-4" aria-live="polite">
          <header
            className={`rounded-3xl p-5 ${
              preview.importable ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"
            }`}
          >
            <p className="text-sm font-bold uppercase tracking-wide">
              {preview.importable ? "Kan importeres" : "Kan ikke importeres"}
            </p>
            <h2 className="mt-1 text-2xl font-black">{preview.order.name}</h2>
            <p className="mt-1 text-sm">
              Betaling: {preview.order.financialStatus ?? "Ukjent"} · Oppfyllelse:{" "}
              {preview.order.fulfillmentStatus ?? "Ukjent"}
            </p>
          </header>

          {preview.reasons.length > 0 && (
            <div className="rounded-3xl bg-white p-5">
              <h3 className="font-black">Må avklares</h3>
              <ul className="mt-3 space-y-2">
                {preview.reasons.map((item, index) => (
                  <li key={`${item.code}-${item.lineId ?? "order"}-${index}`} className="text-sm">
                    {item.message}{" "}
                    <span className="font-mono text-xs text-neutral-500">({item.code})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {preview.lines.map((line) => (
              <article key={line.lineId} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">{line.title}</h3>
                    <p className="text-sm text-neutral-500">
                      {line.variantTitle ?? "Standardvariant"} · {line.sku ?? "Uten SKU"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      line.importable
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {line.importable ? "Klar" : "Stopp"}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-neutral-500">Antall</dt>
                    <dd className="font-bold">{line.requestedQuantity}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Lokasjon</dt>
                    <dd className="font-bold">{line.locationCode ?? "Ikke valgt"}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Produkt i Snake</dt>
                    <dd className="font-bold">{line.productName ?? "Ingen match"}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Fysisk beholdning</dt>
                    <dd className="font-bold">{line.availableQuantity ?? "Ukjent"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          {preview.importable && (
            <div className="sticky bottom-3 rounded-3xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur">
              <button
                type="button"
                onClick={importOrder}
                disabled={importing}
                className="min-h-14 w-full rounded-2xl bg-emerald-700 px-5 text-base font-black text-white disabled:opacity-60"
              >
                {importing ? "Importerer …" : "Importer til Viper"}
              </button>
              <p className="mt-2 text-center text-xs text-neutral-500">
                Ordren kontrolleres på nytt før import.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
