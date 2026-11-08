import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkedSource,sourcePreflight} from '../lib/viper/picks/source-check.ts';
const order={id:'gid://shopify/Order/1',sourceName:"web",app:{id:"gid://shopify/App/580111"},legacyResourceId:'1',name:'#1',createdAt:'2026-11-03T00:00:00Z',updatedAt:'2026-11-03T00:00:00Z',cancelledAt:null,closed:false,fulfillable:true,displayFinancialStatus:'PAID',displayFulfillmentStatus:'UNFULFILLED',lineItems:{pageInfo:{hasNextPage:false},nodes:[{id:'L1',title:'Product',variantTitle:null,sku:'S1',unfulfilledQuantity:2,requiresShipping:true,variant:{id:'gid://shopify/ProductVariant/1',sku:'S1'}}]}};
const stored={source:'shopify',external_order_id:order.id,external_updated_at:order.updatedAt};
test('start and first completion reject disallowed or missing origin before advancing',async()=>{
 for(const action of ['start','complete'] as const) {
  for(const origin of [
   {sourceName:'zettle',app:{id:'gid://shopify/App/2627233'}},
   {sourceName:'pos',app:order.app},
   {sourceName:'unknown',app:order.app},
   {sourceName:'web',app:{id:'gid://shopify/App/2627233'}},
   {sourceName:null,app:null},
   {},
  ]) {
   const {sourceName,app,...base}=order;
   void sourceName; void app;
   const candidate={...base,...origin} as typeof order;
   let advances=0;
   await assert.rejects(async()=>{
    await sourcePreflight({action,actorId:'A',expectedVersion:6,recover:async()=>null,
     load:async()=>({version:6,status:'in_progress',assigned_to:'A',order:stored}),fetch:async()=>candidate});
    advances++;
   },/SOURCE_INELIGIBLE/);
   assert.equal(advances,0);
  }
 }
});
test('fresh observation preserves separate observation/source timestamps and line identity',()=>{
 const p=checkedSource(order,stored,new Date('2026-11-04T00:00:00Z'));
 assert.equal(p.observedAt,'2026-11-04T00:00:00.000Z');assert.equal(p.externalUpdatedAt,order.updatedAt);assert.equal(p.lines[0].requestedQuantity,2);
});
test('conservative source rejection covers metadata changes, cancellation, fulfillment and incomplete sources',()=>{
 assert.throws(()=>checkedSource(null,stored),/SOURCE_MISSING/);
 assert.throws(()=>checkedSource({...order,updatedAt:'2026-11-03T00:00:01Z'},stored),/SOURCE_CHANGED/);
 for(const changed of [{...order,cancelledAt:order.updatedAt},{...order,closed:true},{...order,displayFinancialStatus:'PENDING'},{...order,displayFulfillmentStatus:'FULFILLED'},{...order,lineItems:{...order.lineItems,pageInfo:{hasNextPage:true}}}])assert.throws(()=>checkedSource(changed,stored),/SOURCE_INELIGIBLE/);
});
test('recovery returns before any Shopify access, including an outage',async()=>{
 const result=await sourcePreflight({action:'complete',actorId:'A',expectedVersion:2,recover:async()=>({status:'completed'}),load:async()=>{throw Error('must not load');},fetch:async()=>{throw Error('must not fetch');}});
 assert.deepEqual(result.recovered,{status:'completed'});
});
test('unavailable Shopify fails closed and local stale state never reaches Shopify',async()=>{
 let fetches=0;
 const deps={action:'start' as const,actorId:'A',expectedVersion:0,recover:async()=>null,load:async()=>({version:0,status:'ready',assigned_to:null,order:stored}),fetch:async()=>{fetches++;throw Error('timeout');}};
 await assert.rejects(sourcePreflight(deps),/SOURCE_UNAVAILABLE/);assert.equal(fetches,1);
 await assert.rejects(sourcePreflight({...deps,expectedVersion:1}),/STALE_VERSION/);assert.equal(fetches,1);
});
test('source request has no mutation callbacks and SQL checks again after waiting',()=>{
 const sql=readFileSync('supabase/migrations/20261104201000_viper_fresh_start_completion.sql','utf8');
 assert.match(sql,/AFTER lock waits/);assert.match(sql,/job.version is distinct from requested_expected_version/);
 assert.match(sql,/actual_lines is distinct from supplied_lines/);assert.match(sql,/order by id for update/);
 assert.match(sql,/for share/);assert.doesNotMatch(sql,/http_|net.http/);
 const handler=readFileSync('lib/viper/picks/command-handler.ts','utf8');
 assert.ok(handler.indexOf('await sourcePreflight')<handler.indexOf("db.rpc('apply_viper_pick_command'"));
 assert.match(handler,/requested_source:sourceProof/);
});

test('start and completion never advance on source failures',async()=>{
 for(const action of ['start','complete'] as const) {
  for(const outcome of ['timeout','scope','missing','changed','cancelled']) {
   let writes=0;
   const deps={action,actorId:'A',expectedVersion:2,recover:async()=>null,
    load:async()=>({version:2,status:'in_progress',assigned_to:'A',order:stored}),
    fetch:async()=>{
     if(outcome==='timeout'||outcome==='scope')throw Error(outcome);
     if(outcome==='missing')return null;
     if(outcome==='changed')return {...order,updatedAt:'2026-11-03T00:00:01Z'};
     return {...order,cancelledAt:order.updatedAt};
    }};
   await assert.rejects(async()=>{await sourcePreflight(deps);writes++;});
   assert.equal(writes,0);
  }
 }
});
test('current eligible source and ownership are required before advancing',async()=>{
 const deps={action:'complete' as const,actorId:'A',expectedVersion:2,recover:async()=>null,
  load:async()=>({version:2,status:'in_progress',assigned_to:'A',order:stored}),fetch:async()=>order};
 const result=await sourcePreflight(deps);assert.equal(result.proof?.externalOrderId,order.id);
 await assert.rejects(sourcePreflight({...deps,actorId:'B'}),/FORBIDDEN/);
});
