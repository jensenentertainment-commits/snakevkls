import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowUpRight, ClipboardList, CircleCheck, ListChecks } from "lucide-react";
import { Surface } from "@/app/components/design-system/Surface";
import { formatRoyTime as formatTime } from "@/lib/intelligence/roy/format-time";
import type { WarehouseOverviewData } from "@/lib/warehouse-overview/model";
import { overviewUpdateStatus } from "@/lib/warehouse-overview/update-status";
import { RefreshOverview } from "./RefreshOverview";

const linkStyle = "inline-flex min-h-9 items-center gap-1 rounded-snake-control text-sm font-medium text-snake-text-on-dark underline decoration-snake-text-on-dark-muted/40 underline-offset-4 hover:decoration-snake-text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark";
const rowStyle = "rounded-snake-control border border-snake-border-on-dark-subtle bg-snake-app-deep/40 px-4 py-3";
function Unavailable({ label }: { label: string }) {
  return <p role="status" className="rounded-snake-control border border-snake-border-on-dark-default p-4 text-sm leading-6 text-snake-text-on-dark-muted">Kunne ikke hente {label}. Prøv «Oppdater».</p>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-snake-control bg-snake-app-deep/30 p-4 text-sm leading-6 text-snake-text-on-dark-muted"><CircleCheck className="mt-1 shrink-0" size={17} aria-hidden="true" /><p>{children}</p></div>;
}
function More({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={linkStyle}>{children}<ArrowUpRight size={14} aria-hidden="true" /></Link>;
}

export function WarehouseOverview({ data }: { data: WarehouseOverviewData }) {
  const { issues, counts, picks, activity } = data;
  const update = overviewUpdateStatus(data);
  return <div className="space-y-4 text-snake-text-on-dark">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-snake-panel border border-snake-border-on-dark-subtle bg-snake-hero px-5 py-3 sm:px-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-snake-text-on-dark-muted">Lager</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Oversikt</h1>
        <p className="mt-1 text-sm text-snake-text-on-dark-muted">Registrert arbeid og siste hendelser i Snake.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-snake-text-on-dark-muted" aria-live="polite">
          <p>{update.summary}</p>
          {update.showDetails && <details className="mt-1 max-w-sm">
            <summary className="cursor-pointer rounded-snake-control py-1 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark">Oppdateringsstatus</summary>
            <ul className="space-y-1 pt-1">{update.entries.map(entry => <li key={entry.label}>{entry.label}: {entry.ok ? entry.time ?? "Tidspunkt ukjent" : "Kunne ikke hente data"}</li>)}</ul>
          </details>}
        </div><RefreshOverview />
      </div>
    </header>
    <div className="grid gap-4 xl:grid-cols-2">
      <Surface as="section" variant="dark" aria-labelledby="followup-title" className="min-w-0 border border-snake-border-on-dark-subtle p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3"><ListChecks className="text-snake-text-on-dark-muted" size={20} aria-hidden="true" /><h2 id="followup-title" className="text-lg font-semibold">Trenger oppfølging</h2>
          {issues.ok && issues.data.length > 0 && <span className="ml-auto rounded-full bg-snake-hero px-2.5 py-1 text-xs">{issues.data.length} funn</span>}
        </div>
        {!issues.ok ? <Unavailable label="avviksgrunnlaget" /> : issues.data.length === 0 ? <Empty>Ingen registrerte funn etter gjeldende avviksregler.</Empty> : <ul className="space-y-2">{issues.data.slice(0, 3).map(item => <li key={item.id} className={rowStyle}>
          <Link href={item.href} aria-label={`${item.action}: ${item.title}`} className="flex min-h-9 items-center justify-between gap-3 rounded-snake-control text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark"><span className="min-w-0 break-words">{item.title}</span><ArrowUpRight size={15} className="shrink-0 text-snake-text-on-dark-muted" aria-hidden="true" /></Link>
          <p className="mt-1 text-xs leading-5 text-snake-text-on-dark-muted">{item.type}</p>
        </li>)}</ul>}
        <p className="mt-3 text-xs leading-5 text-snake-text-on-dark-muted">Registreringsforhold, ikke bekreftede fysiske lagerfeil. Lagerregistreringen er ikke bekreftet fullført.</p>
        <div className="mt-2"><More href="/issues">{issues.ok && issues.data.length > 3 ? `Se alle ${issues.data.length} funn` : "Åpne Avvik"}</More></div>
      </Surface>
      <Surface as="section" variant="dark" aria-labelledby="work-title" className="min-w-0 border border-snake-border-on-dark-subtle p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3"><ClipboardList className="text-snake-text-on-dark-muted" size={20} aria-hidden="true" /><h2 id="work-title" className="text-lg font-semibold">Pågående arbeid</h2></div>
        <h3 className="mb-2 text-sm font-semibold">Ufullførte tellinger{counts.ok && counts.data.total > 0 ? ` · ${counts.data.total}` : ""}</h3>
        {!counts.ok ? <Unavailable label="tellinger" /> : counts.data.total === 0 ? <Empty>Ingen ufullførte tellinger registrert.</Empty> : <ul className="space-y-2">{counts.data.items.map(item => <li key={item.id} className={`${rowStyle} flex flex-wrap items-center justify-between gap-2`}><span className="text-sm font-medium">{item.location_code}</span><span className="text-xs text-snake-text-on-dark-muted">Sist lagret {formatTime(item.updated_at)}</span></li>)}</ul>}
        {counts.ok && counts.data.total > counts.data.items.length && <p className="mt-2 text-xs text-snake-text-on-dark-muted">Viser de {counts.data.items.length} sist oppdaterte øktene.</p>}
        <More href="/location-count">Åpne Telling</More>
        <div className="mt-5 border-t border-snake-border-on-dark-subtle pt-4">
          <h3 className="mb-2 text-sm font-semibold">Viper <span className="ml-1 text-xs font-normal text-snake-text-on-dark-muted">· Pilot gjenstår</span></h3>
          {!picks.ok ? <Unavailable label="plukkoppdrag" /> : <>
            {picks.data.activePick ? <div className={rowStyle}><p className="text-sm font-medium">Ditt aktive plukk · {picks.data.activePick.orderNumber}</p><More href={`/viper/picks/${picks.data.activePick.pickJobId}`}>Åpne plukk</More></div> : <p className="text-sm text-snake-text-on-dark-muted">Du har ingen aktiv plukkjobb.</p>}
            <p className="mt-2 text-sm text-snake-text-on-dark-muted">{picks.data.readyOrders.length ? `${picks.data.readyOrders.length} oppdrag i arbeidskøen.` : "Ingen oppdrag klare til plukk."}</p>
          </>}
          <More href="/viper">Åpne Viper</More>
        </div>
      </Surface>
    </div>
    <Surface as="section" variant="dark" aria-labelledby="activity-title" className="border border-snake-border-on-dark-subtle p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-3"><Activity size={20} className="text-snake-text-on-dark-muted" aria-hidden="true" /><h2 id="activity-title" className="text-lg font-semibold">Siste lageraktivitet</h2></div><More href="/activities">Se aktivitetsloggen</More></div>
      {!activity.ok ? <Unavailable label="lageraktivitet" /> : activity.data.length === 0 ? <Empty>Ingen lagerhendelser registrert i aktivitetsloggen.</Empty> : <ul className="divide-y divide-snake-border-on-dark-subtle">{activity.data.map(item => <li key={item.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:justify-between sm:gap-6">
        <div className="min-w-0"><p className="break-words text-sm font-medium">{item.title}</p>{item.description && <p className="mt-1 break-words text-sm leading-5 text-snake-text-on-dark-muted">{item.description}</p>}</div>
        <time dateTime={item.created_at} className="shrink-0 text-xs text-snake-text-on-dark-muted">{formatTime(item.created_at)}</time>
      </li>)}</ul>}
    </Surface>
    <p className="px-1 text-xs leading-5 text-snake-text-on-dark-muted">Lagrede Snake-data. Oversikten oppdateres når du åpner siden eller velger «Oppdater». Ingen direkte Shopify-kontroll.</p>
  </div>;
}
