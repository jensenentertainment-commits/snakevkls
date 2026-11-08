import { Surface, Card, StatusBadge } from "@/app/components/design-system";
import Link from 'next/link';
import PickCorrection from '@/app/components/viper/PickCorrection';
import {requireViperAdminPageActor} from '@/lib/viper/auth/access';
import {getSupabaseAdmin} from '@/lib/supabase/admin';
export const dynamic='force-dynamic';
export default async function RecoveryPage(){
 await requireViperAdminPageActor();
 const {data,error}=await getSupabaseAdmin().from('pick_jobs').select('id,version,status,orders!inner(order_number)').in('status',['in_progress','cancelled']).order('status',{ascending:false}).order('created_at').limit(100);
 if(error)throw new Error('Kunne ikke hente plukk for gjenoppretting');
 const rows=data as unknown as {id:string;version:number;status:string;orders:{order_number:string}}[];
 return <><div className="mx-auto min-w-0 [overflow-wrap:anywhere] max-w-3xl"><Surface as="section" variant="workspace" className="p-4 sm:p-6 lg:p-8">
 <h1 className="text-[length:var(--snake-text-heading-section-size)] font-semibold">Gjenopprett Viper-plukk</h1><p className="mt-3 text-sm leading-relaxed text-snake-text-secondary">Avtal med plukkeren før du avbryter. Varer må fysisk tilbakeføres. Gjenoppretting beholder samme ordre og lokasjoner.</p>
 <Link href="/viper/admin/exceptions" className="inline-flex min-h-11 items-center text-snake-link underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus">Åpne avvik</Link>
 {rows.map(j=><Card as="article" key={j.id} className="mt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-[length:var(--snake-text-heading-card-size)] font-semibold">{j.orders.order_number}</h2><StatusBadge tone={j.status==='cancelled'?'neutral':'info'} label={j.status==='cancelled'?'Avbrutt':'Pågår'}/></div><PickCorrection jobId={j.id} version={j.version} cancelled={j.status==='cancelled'}/></Card>)}
 {!rows.length&&<p>Ingen plukk krever gjenoppretting.</p>}
 {rows.length===100&&<p>Viser de første 100 oppdragene.</p>}
 </Surface></div></>;
}
