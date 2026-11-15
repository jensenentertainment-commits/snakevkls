import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { canCompleteCount, isSavedCount, countCommand, countError } from '../lib/inventory/count-session.ts';
const id='00000000-0000-4000-8000-000000000001';
const line={inventory_id:id,product_id:id,product_name:'Synthetic',sku:null,variant_name:null,expected_quantity:3,counted_quantity:null,note:null,saved_at:null};
const session={id,location_id:id,location_code:'TEST',status:'active',version:1,lines:[line],result:null,completed_at:null};
test('typed counts are not saved; zero must be explicitly saved',()=>{
 assert.equal(canCompleteCount(session,{[id]:'0'},{},false),false);
 const saved={...line,counted_quantity:0,saved_at:'2026-11-15T12:00:00Z'};
 assert.equal(isSavedCount(saved,'0',''),true);
 assert.equal(isSavedCount(saved,'',''),false);
 assert.equal(canCompleteCount({...session,lines:[saved]},{[id]:'0'},{},false),true);
});
test('changed value or note disables completion and busy/completed prevents resubmission',()=>{
 const saved={...line,counted_quantity:3,note:'shelf',saved_at:'2026-11-15T12:00:00Z'};
 assert.equal(isSavedCount(saved,'4','shelf'),false);
 assert.equal(isSavedCount(saved,'3','changed'),false);
 assert.equal(canCompleteCount({...session,lines:[saved]},{[id]:'3'},{[id]:'shelf'},true),false);
 assert.equal(canCompleteCount({...session,status:'completed',lines:[saved]},{[id]:'3'},{[id]:'shelf'},false),false);
});
test('empty location requires active persisted session and explicit completion',()=>{
 assert.equal(canCompleteCount(null,{}, {},false),false);
 assert.equal(canCompleteCount({...session,lines:[]},{},{},false),true);
});
test('command ignores client totals, expected stock, actor and routes only explicit actions',()=>{
 const result=countCommand({locationId:id,sessionId:id,version:2,totalLines:999,actorId:id,expectedQuantity:999},'complete');
 assert.deepEqual(Object.keys(result).sort(),['expected_version','requested_action','requested_counted_quantity','requested_inventory_id','requested_location_id','requested_note','requested_session_id']);
 assert.equal(result.requested_action,'complete');
 assert.throws(()=>countCommand({locationId:id,totalLines:999},'complete'));
 assert.throws(()=>countCommand({locationId:id,action:'complete'},'session'));
});
test('invalid numbers, malformed requests and old clients are rejected',()=>{
 const b={locationId:id,sessionId:id,version:1,inventoryId:id,countedQuantity:0};
 assert.equal(countCommand(b,'save').requested_counted_quantity,0);
 for(const value of [null,'',false,-1,1.5,NaN,Infinity,2147483648]) assert.throws(()=>countCommand({...b,countedQuantity:value},'save'));
 for(const value of [null,[],{},'x']) assert.throws(()=>countCommand(value,'save'));
 assert.throws(()=>countCommand({...b,locationId:'wrong'},'save'));
 assert.throws(()=>countCommand({...b,note:'x'.repeat(2001)},'save'));
});
test('conflicts require reload, not automatic retry',()=>{
 for(const code of ['40001','55P03','40P01','23505']) assert.equal(countError(code).status,409);
 assert.equal(countError('22023').status,400);
 assert.equal(countError('unexpected').status,500);
});
test('all HTTP commands authorize before service RPC; server derives actor',()=>{
 const handler=readFileSync('lib/inventory/count-handler.ts','utf8');
 assert.ok(handler.indexOf('requireRole([')<handler.indexOf('.rpc('));
 assert.match(handler,/\["admin", "user", "warehouse"\]/);
 assert.match(handler,/requested_actor_id: auth.user.id/);
 const reader=readFileSync('app/api/location-count/session/route.ts','utf8');
 assert.ok(reader.indexOf('requireRole([')<reader.indexOf('.rpc('));
 for(const path of ['app/api/location-count/route.ts','app/api/location-count/complete/route.ts']) {
   const source=readFileSync(path,'utf8');assert.match(source,/handleCountCommand/);assert.doesNotMatch(source,/\.insert\(|record_location_count/);
 }
});
test('client restores persisted data, retains other drafts, and has explicit recovery',()=>{
 const ui=readFileSync('app/location-count/page.tsx','utf8');
 assert.match(ui,/cache: "no-store"/);assert.match(ui,/acceptSession\(json.session, action !== "save"\)/);
 assert.match(ui,/commandInFlight.current/);assert.match(ui,/canCompleteCount/);assert.match(ui,/window.confirm/);
 assert.doesNotMatch(ui,/totalLines:|matchedLines:|diffLines:|completedLocationIds/);
});
function adapter(allowed=true, error=null) {
 const calls=[];
 const context={exports:{},require(name){
  if(name==='next/server')return {NextResponse:{json:(body,init)=>({body,status:init?.status??200})}};
  if(name.includes('require-role'))return {requireRole:async roles=>{
   assert.deepEqual(Array.from(roles),['admin','user','warehouse']);
   return allowed?{ok:true,user:{id},profile:{display_name:'Synthetic'}}:{ok:false,response:{status:403}};
  }};
  if(name==='./count-session')return {countCommand,countError};
  if(name.includes('/admin'))return {getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:session,error};}})};
  throw Error(name);
 }};
 vm.runInNewContext(ts.transpileModule(readFileSync('lib/inventory/count-handler.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {calls,run:(body,mode='complete')=>context.exports.handleCountCommand({json:async()=>body},mode)};
}
test('executed HTTP adapter denies unauthorized calls and rejects legacy payloads before RPC',async()=>{
 const denied=adapter(false);assert.equal((await denied.run({})).status,403);assert.equal(denied.calls.length,0);
 const valid=adapter();assert.equal((await valid.run({locationId:id,totalLines:1})).status,400);assert.equal(valid.calls.length,0);
});
test('executed adapter derives identity and returns persisted session, with conflict mapping',async()=>{
 const body={locationId:id,sessionId:id,version:2,actorId:'forged',totalLines:1000};
 const r=adapter();assert.equal((await r.run(body)).status,200);assert.equal(r.calls[0].args.requested_actor_id,id);
 assert.equal(r.calls[0].args.totalLines,undefined);assert.equal(r.calls[0].name,'manage_location_count_v1');
 for(const code of ['40001','55P03','40P01'])assert.equal((await adapter(true,{code}).run(body)).status,409);
});
