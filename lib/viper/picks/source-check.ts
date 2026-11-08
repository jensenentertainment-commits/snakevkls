import type {ShopifyOrderPayload} from '../shopify/order-client';
import {sourceReasons,sourceLines} from '../shopify/order-source.ts';
export type SourceSnapshot = {source:string;external_order_id:string;external_updated_at:string|null};
export function checkedSource(order:ShopifyOrderPayload|null, stored:SourceSnapshot, now=new Date()) {
 if(!order) throw new Error('VIPER_SOURCE_MISSING');
 if(order.id!==stored.external_order_id || !stored.external_updated_at || !Number.isFinite(Date.parse(order.updatedAt)) || Date.parse(order.updatedAt)!==Date.parse(stored.external_updated_at)) throw new Error('VIPER_SOURCE_CHANGED');
 if(order.closed!==false || order.fulfillable!==true || order.cancelledAt!==null || order.lineItems.pageInfo.hasNextPage!==false || order.lineItems.nodes.some(l=>!Number.isInteger(l.unfulfilledQuantity)||l.unfulfilledQuantity<0) || sourceReasons(order).length)throw new Error('VIPER_SOURCE_INELIGIBLE');
 return {externalOrderId:order.id,externalUpdatedAt:order.updatedAt,observedAt:now.toISOString(),
   lines:sourceLines(order).map(l=>({externalLineId:l.externalLineId,shopifyVariantId:l.shopifyVariantId,sku:l.sku,requestedQuantity:l.requestedQuantity}))};
}
export const commandErrors: Record<string,string> = {
 VIPER_SOURCE_UNAVAILABLE:'Shopify kunne ikke kontrolleres. Ingen handling er utført. Prøv igjen når forbindelsen er tilbake.',
 VIPER_SOURCE_MISSING:'Ordren finnes ikke lenger i Shopify. Plukket er stoppet.',
 VIPER_SOURCE_CHANGED:'Shopify-ordren er endret etter import. Ikke fortsett plukket. Kontakt administrator; varer må tilbakeføres før eventuell kansellering.',
 VIPER_SOURCE_INELIGIBLE:'Ordren kan ikke plukkes nå: bare nettordre fra Online Store er tillatt. Kontroller også kansellering, betaling og leveringsstatus i Shopify.',
 VIPER_SOURCE_REQUIRED:'Fersk Shopify-kontroll mangler. Prøv igjen.',
 VIPER_SOURCE_EXPIRED:'Shopify-kontrollen er blitt for gammel. Prøv handlingen på nytt.',
 VIPER_STOCK_CHANGED:'Beholdningen på valgt lokasjon er for lav eller lagerposten er flyttet. Kontroller varene og kontakt administrator.',
 VIPER_LOCATION_CHANGED:'Produkt, lokasjon eller sone er deaktivert eller plukkerekkefølgen er endret. Kontakt administrator.',
 VIPER_STALE_VERSION:'Plukket er endret av en annen handling. Oppdater status før du fortsetter.',
 VIPER_FORBIDDEN:'Du har ikke tilgang til denne handlingen.',
};

export async function sourcePreflight(input:{
 recover:()=>Promise<unknown>; load:()=>Promise<{version:number;status:string;assigned_to:string|null;order:SourceSnapshot}>;
 fetch:(id:string)=>Promise<ShopifyOrderPayload|null>; expectedVersion:number; actorId:string; action:'start'|'complete';
}) {
 const recovered=await input.recover();
 if(recovered)return {recovered,proof:null};
 const snapshot=await input.load();
 if(snapshot.version!==input.expectedVersion)throw new Error('VIPER_STALE_VERSION');
 if((input.action==='complete'||snapshot.status==='in_progress')&&snapshot.assigned_to!==input.actorId)throw new Error('VIPER_FORBIDDEN');
 if(snapshot.order.source!=='shopify')return {recovered:null,proof:null};
 let fresh:ShopifyOrderPayload|null;
 try{fresh=await input.fetch(snapshot.order.external_order_id);}catch{throw new Error('VIPER_SOURCE_UNAVAILABLE');}
 return {recovered:null,proof:checkedSource(fresh,snapshot.order)};
}
