"use client";

import { Surface, Button, Card, Progress } from "@/app/components/design-system";


import PickCorrection from "./PickCorrection";
import {useViperCommand} from "./useViperCommand";
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
  const send = useViperCommand();
  const [pick, setPick] = useState(initialPick);
  const [busy, setBusy] = useState(false);
  const [showException, setShowException] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLine = useMemo(
    () => pick.lines.find((line) => line.status === "pending"),
    [pick.lines]
  );
  const readyToComplete =
    pick.status === "in_progress" && pick.completedLines === pick.totalLines && !pick.hasOpenExceptions;

  async function refreshPick() {
    const response = await fetch(`/api/viper/picks/${pick.pickJobId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Kunne ikke oppdatere plukket");
    setPick((await response.json()) as ViperActivePickDto);
  }

  async function confirmLine() {
    if (!activeLine || busy) return;
    setBusy(true); setError(null);
    try {
      await send(`/api/viper/pick-lines/${activeLine.id}/confirm`,pick.version);
      await refreshPick();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Noe gikk galt");
    } finally { setBusy(false); }
  }

  async function reportException(type: ViperPickExceptionType) {
    if (!activeLine || busy) return;
    setBusy(true); setError(null);
    try {
      await send(`/api/viper/pick-lines/${activeLine.id}/exceptions`,pick.version,{exceptionType:type});
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
      await send(`/api/viper/picks/${pick.pickJobId}/complete`,pick.version);
      router.push("/viper");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Noe gikk galt");
      setBusy(false);
    }
  }

  return (
    <Surface as="section" variant="workspace" className="overflow-hidden rounded-snake-panel bg-snake-workspace text-snake-text-primary shadow-snake-overlay">
      <header className="bg-snake-hero px-5 py-5 text-snake-text-on-dark">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-snake-text-on-dark-muted">
          {pick.orderNumber}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-[length:var(--snake-text-heading-section-size)] font-semibold">Plukk varer</h1>
          <p className="font-semibold">{pick.completedLines} av {pick.totalLines}</p>
        </div>
        <div className="mt-4 rounded-snake-control bg-snake-surface p-3">
          <Progress label="Plukkfremdrift" value={pick.completedLines} max={pick.totalLines || 1} />
        </div>
      </header>

      <div className="p-4 sm:p-6">
        {pick.status === "completed" ? (
          <div className="rounded-snake-card bg-snake-surface p-6 text-center"><h2 className="text-[length:var(--snake-text-heading-section-size)] font-semibold">Plukket er fullført</h2><Button onClick={()=>router.push("/viper")} variant="secondary" size="lg" className="h-auto py-3 whitespace-normal mt-4 min-h-12">Tilbake til køen</Button></div>
        ) : activeLine ? (
          <Card as="article" className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-snake-link">
              Linje {activeLine.sequenceNumber} av {pick.totalLines}
            </p>
            <div className="mt-4 rounded-snake-card bg-snake-surface-warm px-5 py-6 text-center">
              <MapPin className="mx-auto h-7 w-7 text-snake-warning" />
              <p className="mt-1 text-[length:var(--snake-text-display-page-mobile-size)] sm:text-[length:var(--snake-text-display-page-size)] font-semibold [overflow-wrap:anywhere]">{activeLine.locationCode}</p>
            </div>
            <h2 className="mt-5 text-[length:var(--snake-text-heading-section-size)] font-semibold leading-tight">{activeLine.productName}</h2>
            {activeLine.variantName && <p className="mt-1 text-snake-text-secondary">{activeLine.variantName}</p>}
            <p className="mt-3 text-sm font-semibold text-snake-text-secondary">
              {activeLine.sku ? `SKU ${activeLine.sku}` : "Uten SKU"}
            </p>
            <div className="mt-5 rounded-snake-action bg-snake-surface-subtle p-5 text-center">
              <p className="text-sm font-semibold uppercase text-snake-text-secondary">Plukk antall</p>
              <p className="text-[length:var(--snake-text-display-page-size)] font-semibold tabular-nums">{activeLine.expectedQuantity}</p>
            </div>

            {activeLine.hasOpenException ? (
              <div className="mt-5 rounded-snake-action bg-snake-warning-surface p-4 text-center font-semibold text-snake-warning">
                Avviket må løses før du kan fortsette
              </div>
            ) : (
              <Button
                type="button" onClick={confirmLine} disabled={busy}
                variant="primary" size="lg" className="h-auto py-3 whitespace-normal mt-5 min-h-16 w-full"
              >
                <Check className="inline-block h-6 w-6" aria-hidden="true" /> {busy ? "Lagrer …" : "Bekreft plukket"}
              </Button>
            )}

            {!activeLine.hasOpenException && (
              <Button
                type="button" onClick={() => setShowException((value) => !value)}
                variant="secondary" size="lg" className="h-auto py-3 whitespace-normal mt-3 min-h-12 w-full"
              >
                <AlertTriangle className="inline-block h-5 w-5" aria-hidden="true" /> Registrer avvik
              </Button>
            )}
            {showException && (
              <div className="mt-2 space-y-2 rounded-snake-action border border-snake-warning-border bg-snake-warning-surface p-3">
                {(Object.keys(exceptionLabels) as ViperPickExceptionType[]).map((type) => (
                  <Button key={type} type="button" disabled={busy} onClick={() => reportException(type)}
                    variant="secondary" size="lg" className="h-auto py-3 whitespace-normal min-h-12 w-full">
                    {exceptionLabels[type]}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <div className="rounded-snake-card bg-snake-surface p-6 text-center">
            <PackageCheck className="mx-auto h-12 w-12 text-snake-success" />
            <h2 className="mt-3 text-[length:var(--snake-text-heading-section-size)] font-semibold">Alle varer er plukket</h2>
            <Button type="button" onClick={completePick} disabled={!readyToComplete || busy}
              variant="primary" size="lg" className="h-auto py-3 whitespace-normal mt-6 min-h-16 w-full">
              {pick.hasOpenExceptions ? "Avvik må løses først" : busy ? "Fullfører …" : "Fullfør plukk"}
            </Button>
          </div>
        )}
        {pick.status === "in_progress" && <PickCorrection jobId={pick.pickJobId} version={pick.version} lines={pick.lines.filter(l=>l.status==="picked")} onDone={refreshPick} />}
        <Button disabled={busy} onClick={()=>refreshPick().catch(()=>setError("Kunne ikke oppdatere plukket"))} variant="secondary" size="lg" className="h-auto py-3 whitespace-normal mt-3 min-h-12 w-full">Oppdater status</Button>
        {error && <p role="alert" className="mt-4 text-center font-semibold text-snake-danger">{error}</p>}
      </div>
    </Surface>
  );
}
