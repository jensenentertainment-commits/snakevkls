'use client';
import { useRef, useState } from 'react';
import { Button } from '@/app/components/design-system/Button';
import { Surface } from '@/app/components/design-system/Surface';
import { parseReview, REVIEW_RULES, reviewIntroduction, type ReviewReport, type ReviewFinding } from '@/lib/intelligence/roy/review';

const time = (s: string|null) => s ? new Date(s).toLocaleString('nb-NO',{timeZone:'Europe/Oslo'}) : 'Ikke observert';
function Finding({finding:f}: {finding:ReviewFinding}) {
  const rule=REVIEW_RULES[f.rule];
  const status=f.assessment==='unknown'?'Ikke vurderbar nå':f.state==='resolved'?'Løst':f.state==='out_of_scope'?'Utenfor aktiv katalog':f.event==='new'?'Nytt':f.event==='reopened'?'Gjenåpnet':'Eksisterende';
  return <li className="rounded-snake-card border border-snake-border-subtle p-4">
    <p className="text-sm text-snake-text-secondary">{status} · {f.priority===1?'Datagrunnlag':f.priority===2?'Anbefaling':'Informasjon'}</p>
    <h3 className="mt-1 font-semibold">{f.label} – {rule[0]}</h3>
    <p className="mt-2 text-sm">{f.assessment==='unknown'?'Tidligere funn beholdes inntil grunnlaget kan vurderes.':`${rule[1]} ${rule[2]}`}</p>
    <p className="mt-2 break-all text-xs text-snake-text-secondary">{f.entity_id}</p>
  </li>;
}
export function RoyWorkReport({initial,loadError,canRun}: {initial:ReviewReport|null;loadError:boolean;canRun:boolean}) {
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
  const top=report?.findings.filter(f=>f.state==='open'&&f.priority<=2).slice(0,5)??[];
  return <Surface className="mb-6 p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><h2 className="text-xl font-semibold">Roys arbeidsrapport</h2>
      {canRun?<Button onClick={()=>void run()} disabled={busy}>{busy?'Roy kontrollerer…':'Kontroller lagret katalog'}</Button>:null}</div>
    {error?<p role="alert" className="mt-3 text-sm">{error}</p>:null}
    {report?.run?<>
      <p className="mt-4 leading-7">{reviewIntroduction(report.run.summary)}</p>
      <p className="mt-2 text-sm text-snake-text-secondary">Siste kontroll: {time(report.run.completed_at)}. Bygger på lagrede katalogdata, ikke live Shopify.</p>
      <p className="mt-1 text-xs text-snake-text-secondary">Innhold observert: {time(report.run.summary.sourceOldest)} – {time(report.run.summary.sourceNewest)}. En ny kontroll oppdaterer ikke Shopify-dataene.</p>
      <ul className="mt-4 space-y-3">{top.map(f=><Finding key={f.id} finding={f}/>)}</ul>
      <button type="button" aria-expanded={detail} onClick={()=>setDetail(!detail)} className="mt-4 text-sm font-semibold underline">{detail?'Skjul detaljert funnliste':'Vis detaljert funnliste og valgfrie felt'}</button>
      {detail?<div><p className="my-3 text-sm">Informasjon om valgfrie felt er ikke en feilrapport. «Løst» betyr at betingelsen ikke lenger finnes i lagrede data.</p>
        <p className="my-3 text-sm text-snake-text-secondary">{report.run.summary.new} nye · {report.run.summary.resolved} løste · {report.run.summary.reopened} gjenåpnede registreringer, inkludert informasjon.</p><ul className="space-y-3">{report.findings.map(f=><Finding key={f.id} finding={f}/>)}</ul>
        {report.findings.length<report.total?<Button onClick={()=>void more()} disabled={busy}>Vis flere ({report.findings.length} av {report.total})</Button>:null}</div>:null}
    </>:<p className="mt-4 text-snake-text-secondary">{error?'Rapportstatus er ukjent inntil den kan leses igjen. Chatten kan brukes som før.':'Ingen lagret kontroll ennå. En administrator kan starte den første kontrollen. Chatten kan brukes som før.'}</p>}
    <p className="mt-4 text-xs text-snake-text-secondary">Roy lagrer kun kontrollresultater. Ingen endring av produkter, Shopify, Viper eller lagerbeholdning.</p>
  </Surface>;
}
