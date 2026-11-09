'use client';
import { formatRoyTime as time } from '@/lib/intelligence/roy/format-time';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/app/components/design-system/Button';
import { Surface } from '@/app/components/design-system/Surface';
import { parseReview, REVIEW_RULES, reviewIntroduction, type ReviewReport, type ReviewFinding } from '@/lib/intelligence/roy/review';

function Finding({finding:f, compact=false}: {finding:ReviewFinding;compact?:boolean}) {
  const rule=REVIEW_RULES[f.rule];
  const status=f.assessment==='unknown'?'Ikke vurderbar nå':f.state==='resolved'?'Løst':f.state==='out_of_scope'?'Utenfor aktiv katalog':f.event==='new'?'Nytt':f.event==='reopened'?'Gjenåpnet':'Eksisterende';
  return <li className={`rounded-snake-card border border-snake-border-on-dark-default bg-snake-app-elevated p-3 ${compact ? "border-l-2 border-l-snake-brand" : ""}`}>
    <p className="text-sm text-snake-text-on-dark-muted">{status} · {f.priority===1?'Datagrunnlag':f.priority===2?'Anbefaling':'Informasjon'}</p>
    <h3 className="mt-1 font-semibold">{f.label} – {rule[0]}</h3>
    <p className="mt-2 text-sm">{f.assessment==='unknown'?'Tidligere funn beholdes inntil grunnlaget kan vurderes.':`${rule[1]} ${rule[2]}`}</p>
    {!compact?<p className="mt-2 break-all text-xs text-snake-text-on-dark-muted">{f.entity_id}</p>:null}
  </li>;
}
export function RoyWorkReport({initial,loadError,canRun,children}: {initial:ReviewReport|null;loadError:boolean;canRun:boolean;children:ReactNode}) {
  const [report,setReport]=useState(initial);
  const [error,setError]=useState(loadError?'Forrige rapport kunne ikke hentes. Chatten er fortsatt tilgjengelig.':'');
  const [busy,setBusy]=useState(false);
  const [detail,setDetail]=useState(false);
  const requestId=useRef<string|null>(null);
  async function run() {
    setBusy(true);setError('');
    requestId.current ??= crypto.randomUUID();
    try {
      const response=await fetch('/api/roy/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:requestId.current})});
      const data=await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Kontrollen feilet.');
      const read=await fetch('/api/roy/review',{cache:'no-store'});
      if (!read.ok) throw new Error('Kontrollen kan være lagret, men rapporten kunne ikke hentes. Prøv samme kontroll igjen.');
      setReport(parseReview(await read.json())); requestId.current=null;
    } catch(e) { setError(e instanceof Error?e.message:'Kontrollen feilet.'); }
    finally {setBusy(false);}
  }
  async function more() {
    if (!report?.run) return;
    setBusy(true);setError('');
    try {
      const r=await fetch(`/api/roy/review?run=${report.run.id}&offset=${report.findings.length}`,{cache:'no-store'});
      const body=await r.json(); if (!r.ok) throw new Error(body.error ?? 'Kunne ikke hente flere funn.');
      const page=parseReview(body);
      setReport({...page,findings:[...report.findings,...page.findings]});
    } catch(e) {setError(e instanceof Error?e.message:'Kunne ikke hente flere funn.');} finally {setBusy(false);}
  }
  const top=report?.findings.filter(f=>f.state==='open'&&f.priority<=2).slice(0,3)??[];
  return <Surface as="section" variant="dark" className="overflow-hidden border border-snake-border-on-dark-default">
    <header className="bg-snake-hero px-5 py-5 text-snake-text-on-dark sm:px-8">
      <h1 className="text-[length:var(--snake-text-display-page-mobile-size)] font-semibold tracking-tight sm:text-[length:var(--snake-text-display-page-size)]">Roy</h1>
      <p className="mt-1 text-lg">Produktansvarlig</p>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-snake-border-on-dark-subtle bg-snake-app-elevated px-5 py-3 text-snake-text-on-dark sm:px-8">
      <p className="text-sm" role="status">{busy?'Roy undersøker katalogen…':report?.run?`Siste katalogkontroll: ${time(report.run.completed_at)}`:error?'Rapportstatus er ikke tilgjengelig.':'Ingen katalogkontroll gjennomført.'}</p>
      {canRun?<div><Button variant="secondary" size="sm" onClick={()=>void run()} disabled={busy}>{busy?'Roy kontrollerer…':'Kontroller katalogen'}</Button></div>:null}
    </div>
    <div className="grid items-start lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    {children}
    <section aria-labelledby="roy-report-title" className="min-w-0 self-stretch border-t border-snake-border-on-dark-default bg-snake-app-deep p-5 sm:p-6 lg:border-l lg:border-t-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="roy-report-title" className="text-xl font-semibold text-snake-brand">Siste arbeidsrapport</h2>
</div>
    {error?<p role="alert" className="mt-3 text-sm">{error}</p>:null}
    {report?.run?<>
      <p className="mt-3 text-sm leading-6">{reviewIntroduction(report.run.summary)}</p>
      <p className="mt-2 text-sm text-snake-text-on-dark-muted">Bygger på sist lagrede katalogdata, ikke en ny innhenting fra Shopify.</p>
      {top.length>0?<ul aria-label="Fremhevede anbefalinger" className="mt-4 space-y-3">{top.map(f=><Finding key={f.id} finding={f} compact/>)}</ul>:null}
      <button type="button" aria-expanded={detail} aria-controls="roy-finding-details" onClick={()=>setDetail(!detail)} className="mt-4 min-h-11 text-sm font-semibold text-snake-text-on-dark underline underline-offset-4">{detail?'Skjul alle funn':'Se alle funn og kontrolldetaljer'}</button>
      {detail?<div id="roy-finding-details"><p className="my-3 text-sm text-snake-text-on-dark-muted">Innhold observert: {time(report.run.summary.sourceOldest)} – {time(report.run.summary.sourceNewest)}. En ny kontroll oppdaterer ikke Shopify-dataene.</p><p className="my-3 text-sm">Informasjon om valgfrie felt er ikke en feilrapport. «Løst» betyr at betingelsen ikke lenger finnes i lagrede data.</p>
        <p className="my-3 text-sm text-snake-text-on-dark-muted">{report.run.summary.new} nye · {report.run.summary.resolved} løste · {report.run.summary.reopened} gjenåpnede registreringer, inkludert informasjon.</p><ul className="space-y-3">{report.findings.map(f=><Finding key={f.id} finding={f}/>)}</ul>
        {report.findings.length<report.total?<Button onClick={()=>void more()} disabled={busy}>Vis flere ({report.findings.length} av {report.total})</Button>:null}</div>:null}
    </>:<p className="mt-4 text-snake-text-on-dark-muted">{error?'Rapportstatus er ukjent inntil den kan leses igjen. Chatten kan brukes som før.':'Ingen lagret kontroll ennå. En administrator kan starte den første kontrollen. Chatten kan brukes som før.'}</p>}
  </section></div></Surface>;
}
