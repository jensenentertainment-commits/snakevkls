"use client";

import { Button } from "@/app/components/design-system";

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useViperCommand} from './useViperCommand';
export default function PickCorrection({jobId,version,lines=[],cancelled=false,onDone}:{
 jobId:string;version:number;lines?:{id:string;productName:string}[];cancelled?:boolean;onDone?:()=>Promise<void>;
}) {
 const router=useRouter(); const send=useViperCommand();
 const [action,setAction]=useState(''); const [reason,setReason]=useState('');
 const [returned,setReturned]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 async function submit() {
   if(busy||!action||!reason.trim()||!returned)return;
   setBusy(true);setError('');
   const url=action==='cancel' ? '/api/viper/picks/'+jobId+'/cancel' : action==='reprepare'
     ? '/api/viper/admin/picks/'+jobId+'/reprepare' : '/api/viper/pick-lines/'+action+'/undo';
   try {
     await send(url,version,{reason:reason.trim(),physicalReturnConfirmed:returned});
     setAction('');setReason('');setReturned(false);
     if(onDone && action!=='cancel') await onDone();
     else {router.push('/viper');router.refresh();}
   }catch(e){setError(e instanceof Error?e.message:'Mistet forbindelsen. Prøv samme handling igjen.');}
   finally{setBusy(false);}
 }
 return <details className="mt-4 rounded-snake-control border border-snake-border-default p-4 text-snake-text-primary">
   <summary className="min-h-11 cursor-pointer py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus">{cancelled?'Gjenopprett plukk':'Korriger eller avbryt plukk'}</summary>
   <label className="mt-3 block">Handling<select disabled={busy} value={action} onChange={e=>{setAction(e.target.value);setReturned(false);}} className="mt-2 block min-h-12 w-full rounded-snake-control border border-snake-border-default bg-snake-surface p-3 text-snake-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus">
     <option value="">Velg handling</option>
     {lines.map(l=><option key={l.id} value={l.id}>Angre bekreftelse: {l.productName}</option>)}
     <option value={cancelled?'reprepare':'cancel'}>{cancelled?'Gjør klart for nytt plukk':'Avbryt hele plukket'}</option>
   </select></label>
   <label className="mt-3 block">Begrunnelse<textarea disabled={busy} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 block min-h-24 w-full rounded-snake-control border border-snake-border-default bg-snake-surface p-3 bg-snake-surface text-snake-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus" /></label>
   <label className="mt-3 flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input className="mt-1 h-5 w-5 shrink-0 accent-snake-primary" type="checkbox" disabled={busy} checked={returned} onChange={e=>setReturned(e.target.checked)} />Jeg bekrefter at alle varer for handlingen er lagt tilbake på de opprinnelige lokasjonene, eller at ingen varer ble tatt ut.</label>
   <Button disabled={busy||!action||!reason.trim()||!returned} onClick={submit} variant="danger" size="lg" className="h-auto py-3 whitespace-normal mt-3 min-h-12">{busy?'Lagrer …':'Bekreft korrigering'}</Button>
   {error&&<p role="alert" className="mt-2 text-snake-danger">{error}</p>}
 </details>;
}
