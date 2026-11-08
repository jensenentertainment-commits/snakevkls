import {fetchShopifyOrderForPreview} from '@/lib/viper/shopify/order-client';
import {checkedSource,sourcePreflight,commandErrors,type SourceSnapshot} from './source-check';
import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { ViperActor } from '@/lib/viper/auth/access';
import { isUuid } from '@/lib/viper/orders/validation';
import { parsePickCommand, type PickAction } from './command-validation';

export async function handleViperCommand(request: Request, id: string, action: PickAction, actor: ViperActor) {
 if(!isUuid(id)) return NextResponse.json({error:'Ugyldig oppdrag'}, {status:400});
 const command=parsePickCommand(await request.json().catch(()=>null));
 if(!command) return NextResponse.json({error:'Oppdater siden før du prøver igjen.'},{status:400});
 const db=getSupabaseAdmin();
 let jobId=id;
 const payload={...command.payload};
 if(['confirm','report','undo','resolve'].includes(action)) {
   const exception=action==='resolve';
   const {data,error}=await db.from(exception?'pick_exceptions':'pick_lines').select('pick_job_id').eq('id',id).maybeSingle();
   if(error) return NextResponse.json({error:'Kunne ikke hente plukket'},{status:500});
   if(!data) return NextResponse.json({error:'Plukket finnes ikke'},{status:404});
   jobId=data.pick_job_id;
   payload[exception?'exceptionId':'lineId']=id;
 }
 let sourceProof: ReturnType<typeof checkedSource> | null=null;
 if(action==='start'||action==='complete') {
   try {
     const checked=await sourcePreflight({action,expectedVersion:command.expectedVersion,actorId:actor.id,
       recover:async()=>{
         const r=await db.rpc('get_viper_pick_command_result',{
           requested_pick_job_id:jobId,requested_expected_version:command.expectedVersion,
           requested_command_id:command.commandId,requested_action:action,requested_payload:payload,requested_actor_id:actor.id,
         });
         if(r.error)throw new Error('VIPER_RECOVERY_FAILED');return r.data;
       },
       load:async()=>{
         const r=await db.from('pick_jobs').select('version,status,assigned_to,orders!inner(source,external_order_id,external_updated_at)').eq('id',jobId).maybeSingle();
         if(r.error||!r.data)throw new Error('VIPER_SNAPSHOT_FAILED');
         return {...r.data,order:r.data.orders as unknown as SourceSnapshot};
       },
       fetch:fetchShopifyOrderForPreview,
     });
     if(checked.recovered)return NextResponse.json(checked.recovered,{headers:{'Cache-Control':'private, no-store'}});
     sourceProof=checked.proof;
   }catch(e){
     const code=e instanceof Error?e.message:'';
     return NextResponse.json({error:commandErrors[code]??'Kunne ikke kontrollere ordregrunnlaget. Ingen handling er utført.'},{status:code==='VIPER_SOURCE_UNAVAILABLE'?503:code==='VIPER_FORBIDDEN'?403:409});
   }
 }
 const {data,error}=await db.rpc('apply_viper_pick_command',{
   requested_source:sourceProof,
   requested_pick_job_id:jobId,requested_expected_version:command.expectedVersion,
   requested_command_id:command.commandId,requested_action:action,
   requested_payload:payload,requested_actor_id:actor.id,
 });
 if(error) {
   const forbidden=error.message.includes('VIPER_FORBIDDEN');
   return NextResponse.json({error:commandErrors[error.message]??'Handlingen ble avvist. Oppdater plukket og kontroller status før du prøver igjen.'},
     {status:forbidden?403:409});
 }
 return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
}
