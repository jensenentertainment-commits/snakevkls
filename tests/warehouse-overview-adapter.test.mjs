import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {inventoryIssues,readAllIssuePages} from '../lib/inventory/issues.ts';
import {collectOverview} from '../lib/warehouse-overview/model.ts';

function adapter(role, failTable) {
 const reads=[];let adminCalls=0;let queueActor;
 function client(privileged){return {from(table){const ops=[];const q={};for(const method of ['select','eq','in','order','limit','range'])q[method]=(...args)=>{ops.push([method,...args]);return q;};q.then=(resolve,reject)=>{reads.push({table,ops,privileged});return Promise.resolve({data:failTable===table?null:[],count:0,error:failTable===table?'test error':null}).then(resolve,reject);};return q;}};}
 const mocks={
  'server-only':{},
  '@/lib/auth/require-role':{requireRole:async roles=>roles.includes(role)?{ok:true,authClient:client(false),user:{id:'current-user'},profile:{display_name:null,role}}:{ok:false,response:{status:403}}},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>{adminCalls++;return client(true);}},
  '@/lib/viper/orders/repository':{getViperQueue:async actor=>{queueActor=actor;return {activePick:null,readyOrders:[]};}},
  '@/lib/inventory/issues':{inventoryIssues,readAllIssuePages},
  './model':{collectOverview},
 };
 const code=ts.transpileModule(readFileSync('lib/warehouse-overview/read.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in mocks);return mocks[name];},exports);
 return {run:exports.readWarehouseOverview,reads,adminCalls:()=>adminCalls,actor:()=>queueActor};
}
test('overview server denies unsupported or missing roles before touching data',async()=>{
 for(const role of [undefined,'disabled','anon','viewer','lager']){const a=adapter(role);assert.deepEqual(await a.run(),{ok:false,status:403});assert.equal(a.reads.length,0);assert.equal(a.adminCalls(),0);assert.equal(a.actor(),undefined);}
});
test('all authorized roles retain RLS for warehouse data and bounded privileged session reads',async()=>{
 for(const role of ['admin','user','warehouse']){
  const a=adapter(role);const result=await a.run();assert.equal(result.ok,true);
  assert.deepEqual(a.reads.filter(r=>r.privileged).map(r=>r.table),['location_count_sessions']);
  const count=a.reads.find(r=>r.table==='location_count_sessions');assert.ok(count.ops.some(o=>JSON.stringify(o)===JSON.stringify(['eq','status','active'])));assert.ok(count.ops.some(o=>o[0]==='limit'&&o[1]===3));
  const log=a.reads.find(r=>r.table==='activity_log');assert.equal(log.privileged,false);assert.ok(log.ops.some(o=>o[0]==='limit'&&o[1]===5));
  assert.deepEqual(log.ops.find(o=>o[0]==='in'),['in','entity_type',['product','inventory','location','zone','stock_movement']]);
  assert.equal(a.actor().id,'current-user');assert.equal(a.actor().role,role);
 }
});
test('failed live-query adapter sections cannot masquerade as no work',async()=>{
 for(const [table,key]of [['inventory','issues'],['location_count_sessions','counts'],['activity_log','activity']]){
  const a=adapter('admin',table);const result=await a.run();assert.equal(result.ok,true);assert.deepEqual(result.data[key],{ok:false});
 }
});
