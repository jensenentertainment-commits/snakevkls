"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, MapPin, PackageCheck } from "lucide-react";
import type { ViperActivePickDto, ViperPickExceptionType } from "@/lib/viper/picks/dto";

const exceptionLabels: Record<ViperPickExceptionType, string> = {
  item_not_found: "Varen finnes ikke",
  wrong_quantity: "Feil antall",
  damaged: "Varen er skadet",
};

export default function ViperPickFlow({ initialPick }: { initialPick: ViperActivePickDto }) {
  const router = useRouter();
  const [pick, setPick] = useState(initialPick);
  const [busy, setBusy] = useState(false);
  const [showException, setShowException] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLine = useMemo(
    () => pick.lines.find((line) => line.status === "pending"),
    [pick.lines]
  );
  const readyToComplete =
    pick.completedLines === pick.totalLines && !pick.hasOpenExceptions;

  async function refreshPick() {
    const response = await fetch(`/api/viper/picks/${pick.pickJobId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Kunne ikke oppdatere plukket");
    setPick((await response.json()) as ViperActivePickDto);
  }

  async function confirmLine() {
    if (!activeLine || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/viper/pick-lines/${activeLine.id}/confirm`, { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Kunne ikke bekrefte varen");
      await refreshPick();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Noe gikk galt");
    } finally { setBusy(false); }
  }

  async function reportException(type: ViperPickExceptionType) {
    if (!activeLine || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/viper/pick-lines/${activeLine.id}/exceptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exceptionType: type }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Kunne ikke registrere avviket");
      await refreshPick();
      setShowException(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Noe gikk galt");
    } finally { setBusy(false); }
  }

  async function completePick() {
    if (!readyToComplete || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/viper/picks/${pick.pickJobId}/complete`, { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Kunne ikke fullføre plukket");
      router.push("/viper");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Noe gikk galt");
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[26px] bg-[#e8eef0] text-neutral-950 shadow-2xl shadow-black/30">
      <header className="bg-[#05495b] px-5 py-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">
          {pick.orderNumber}
        </p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="text-2xl font-bold">Plukk varer</h1>
          <p className="font-bold">{pick.completedLines} av {pick.totalLines}</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-[#d4ad3b] transition-all"
            style={{ width: `${pick.totalLines ? (pick.completedLines / pick.totalLines) * 100 : 0}%` }}
          />
        </div>
      </header>

      <div className="p-4">
        {activeLine ? (
          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-[#055a7d]">
              Linje {activeLine.sequenceNumber} av {pick.totalLines}
            </p>
            <div className="mt-4 rounded-3xl bg-[#fff4c7] px-5 py-6 text-center">
              <MapPin className="mx-auto h-7 w-7 text-[#8a6704]" />
              <p className="mt-1 text-4xl font-black">{activeLine.locationCode}</p>
            </div>
            <h2 className="mt-5 text-2xl font-bold leading-tight">{activeLine.productName}</h2>
            {activeLine.variantName && <p className="mt-1 text-neutral-500">{activeLine.variantName}</p>}
            <p className="mt-3 text-sm font-semibold text-neutral-500">
              {activeLine.sku ? `SKU ${activeLine.sku}` : "Uten SKU"}
            </p>
            <div className="mt-5 rounded-2xl bg-neutral-100 p-5 text-center">
              <p className="text-sm font-bold uppercase text-neutral-500">Plukk antall</p>
              <p className="text-5xl font-black">{activeLine.expectedQuantity}</p>
            </div>

            {activeLine.hasOpenException ? (
              <div className="mt-5 rounded-2xl bg-amber-100 p-4 text-center font-bold text-amber-900">
                Avviket må løses før du kan fortsette
              </div>
            ) : (
              <button
                type="button" onClick={confirmLine} disabled={busy}
                className="mt-5 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-5 text-lg font-black text-white disabled:opacity-60"
              >
                <Check className="h-7 w-7" /> {busy ? "Lagrer …" : "Bekreft plukket"}
              </button>
            )}

            {!activeLine.hasOpenException && (
              <button
                type="button" onClick={() => setShowException((value) => !value)}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 text-sm font-bold text-amber-800"
              >
                <AlertTriangle className="h-5 w-5" /> Registrer avvik
              </button>
            )}
            {showException && (
              <div className="mt-2 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                {(Object.keys(exceptionLabels) as ViperPickExceptionType[]).map((type) => (
                  <button key={type} type="button" disabled={busy} onClick={() => reportException(type)}
                    className="min-h-12 w-full rounded-xl bg-white px-4 text-left font-bold shadow-sm">
                    {exceptionLabels[type]}
                  </button>
                ))}
              </div>
            )}
          </article>
        ) : (
          <div className="rounded-3xl bg-white p-6 text-center">
            <PackageCheck className="mx-auto h-12 w-12 text-emerald-700" />
            <h2 className="mt-3 text-2xl font-bold">Alle varer er plukket</h2>
            <button type="button" onClick={completePick} disabled={!readyToComplete || busy}
              className="mt-6 min-h-16 w-full rounded-2xl bg-[#b58a14] px-5 text-lg font-black text-white disabled:bg-neutral-300">
              {pick.hasOpenExceptions ? "Avvik må løses først" : busy ? "Fullfører …" : "Fullfør plukk"}
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-center font-bold text-red-700">{error}</p>}
      </div>
    </section>
  );
}
