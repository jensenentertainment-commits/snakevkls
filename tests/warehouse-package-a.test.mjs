import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {placementRequest, parsePlacement} from '../lib/inventory/placement.ts';
import {inventoryIssues, readAllIssuePages} from '../lib/inventory/issues.ts';
const p='00000000-0000-0000-0000-000000000001', i='00000000-0000-0000-0000-000000000002', l='00000000-0000-0000-0000-000000000003';
const inv={id:i,quantity:10,zone_id:p,location_id:l,locations:{id:l},updated_at:'2026-11-15T12:00:00Z'};
test('pure placement never sends quantity, including stale/invalid input',()=>{
 const body=placementRequest(p,inv,l,'not an amount','place');
 assert.equal('quantity' in body,false); assert.equal(parsePlacement(body).requested_quantity,null);
 for(const field of ['quantity','expectedQuantity','expectedUpdatedAt']) assert.throws(()=>parsePlacement({...body,[field]:10}));
});
test('registration and explicit correction retain identity and expected values',()=>{
 assert.equal(parsePlacement(placementRequest(p,undefined,l,'8','register')).requested_quantity,8);
 const args=parsePlacement(placementRequest(p,inv,l,'12','quantity'));
 assert.equal(args.expected_quantity,10);assert.equal(args.expected_updated_at,inv.updated_at);assert.equal(args.requested_inventory_id,i);
 for(const v of ['', '-1','1.5','2147483648','bad']) assert.throws(()=>placementRequest(p,inv,l,v,'quantity'));
 assert.throws(()=>parsePlacement(placementRequest(p,{...inv,updated_at:undefined},l,'12','quantity')));
 assert.throws(()=>parsePlacement(placementRequest(p,undefined,l,'0','place')));
});
function route(path, authorized=true, dbError=null) {
 const calls=[];
 const context={exports:{}, console, require(name){
  if(name==='next/server')return {NextResponse:{json:(body,init)=>({body,status:init?.status??200})}};
  if(name.includes('require-role'))return {requireRole:async roles=>{
   assert.deepEqual(Array.from(roles),['admin','user','warehouse']);
   return authorized?{ok:true,user:{id:p},profile:{}}:{ok:false,response:{status:403}};
  }};
  if(name.includes('inventory/placement'))return {parsePlacement};
  if(name.includes('/admin'))return {getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{},error:dbError};}})};
  throw Error(name);
 }};
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {calls,post:body=>context.exports.POST({json:async()=>body})};
}
test('retired routes preserve authorization and cannot reach database',async()=>{
 for(const path of ['app/api/inventory/set-location/route.ts','app/api/fix-locations/skip/route.ts']){
  const r=route(path);assert.equal((await r.post({quantity:999})).status,410);assert.equal(r.calls.length,0);
  assert.equal((await route(path,false).post({})).status,403);
 }
});
test('new route preserves roles, derives actor server-side and handles conflicts',async()=>{
 const path='app/api/inventory/placement/route.ts',body=placementRequest(p,inv,l,'9','place');
 const r=route(path);assert.equal((await r.post({...body,actorId:'forged'})).status,200);
 assert.equal(r.calls[0].args.requested_actor_id,p);assert.equal(r.calls[0].name,'save_product_placement_v2');
 for(const code of ['40001','23505','40P01','55P03'])assert.equal((await route(path,true,{code}).post(body)).status,409);
 const denied=route(path,false);assert.equal((await denied.post(body)).status,403);assert.equal(denied.calls.length,0);
 for(const body of [null,{},[],{...placementRequest(p,inv,l,'2','quantity'),quantity:null}])assert.equal((await r.post(body)).status,400);
});
const product={id:p,sku:null,product_name:'Uten SKU',variant_name:null};
const location={id:l,code:'HL01',active:true,zone_id:p,zones:{id:p,code:'HL'}};
const row={id:i,product_id:p,quantity:5,location_id:l,zone_id:p};
test('SKU-less products, multiple locations, empty locations and zero stock are normal',()=>{
 const locations=[location,{...location,id:'second',code:'HL02'}];
 assert.equal(inventoryIssues([product],[row,{...row,id:'other',location_id:'second'},{...row,id:'zero',quantity:0,location_id:null,zone_id:null}],locations).list.length,0);
 assert.equal(inventoryIssues([product],[],locations).list.length,0);
});
test('positive placement observations cover every row without physical-error claims',()=>{
 const r=inventoryIssues([product],[row,{...row,id:'bad',location_id:null},{...row,id:'zone',zone_id:null}],[location]);
 assert.equal(r.list.length,2);assert.equal(r.productCount,2);
 assert.match(r.list[0].type,/uten gyldig/);assert.match(r.list[1].type,/Sone stemmer/);
 assert.ok(r.list.every(x=>x.severity==='warning'&&x.description.includes('ikke en bekreftet')));
 assert.match(inventoryIssues([product],[row],[{...location,active:false}]).list[0].type,/inaktiv/);
 assert.equal(inventoryIssues([product],[row],[{...location,zones:null}]).list.length,2);
});
test('issue loading paginates beyond 1000 and rejects partial failures',async()=>{
 const data=Array.from({length:1201},(_,id)=>({id}));let calls=0;
 assert.equal((await readAllIssuePages(async(a,b)=>{calls++;return {data:data.slice(a,b+1),error:null};})).length,1201);assert.equal(calls,3);
 await assert.rejects(readAllIssuePages(async(a)=>a?{data:null,error:Error('fail')}:{data:data.slice(0,500),error:null}));
});
test('both clients use shared safe contract and cleanup is absent from active navigation',()=>{
 for(const path of ['app/components/products/useProductsActions.ts','app/products/[id]/page.tsx']){
  const s=readFileSync(path,'utf8');assert.match(s,/placementRequest/);assert.match(s,/api\/inventory\/placement/);assert.doesNotMatch(s,/api\/inventory\/set-location/);
 }
 const nav=readFileSync('app/components/navigation/modules.ts','utf8');assert.doesNotMatch(nav,/label: "Ryddemodus"/);
 assert.doesNotMatch(readFileSync('app/lager/page.tsx','utf8'),/\/fix-locations|missingSkuCount|emptyLocationCount/);
 assert.doesNotMatch(readFileSync('app/fix-locations/page.tsx','utf8'),/fetch\(|supabase|onClick/);
});
