import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { collectOverview, type OverviewReaders } from "../lib/warehouse-overview/model.ts";
import { inventoryIssues, readAllIssuePages } from "../lib/inventory/issues.ts";
const empty: OverviewReaders = {issues:async()=>[],counts:async()=>({items:[],total:0}),picks:async()=>({activePick:null,readyOrders:[]}),activity:async()=>[]};
test("empty registered data is successful, not unavailable", async()=>{
 const result=await collectOverview(empty);
 for(const section of Object.values(result)){assert.equal(section.ok,true);if(section.ok)assert.ok(Date.parse(section.readAt));}
 assert.deepEqual(result.issues.ok&&result.issues.data,[]);
});
test("each source fails independently without invented counts or leaked errors",async()=>{
 for(const name of Object.keys(empty)){
  const result=await collectOverview({...empty,[name]:async()=>{throw new Error('private failure');}});
  for(const [key,section]of Object.entries(result))assert.equal(section.ok,key!==name);
  assert.doesNotMatch(JSON.stringify(result),/private failure/);
  assert.deepEqual(result[name as keyof typeof result],{ok:false});
 }
});
test("registered findings and count totals survive presentation limits",async()=>{
 const issues=Array.from({length:5},(_,i)=>({id:String(i),severity:'warning' as const,type:'placement',title:'Testvare',description:'test',href:'/issues',action:'Kontroller'}));
 const result=await collectOverview({...empty,issues:async()=>issues,counts:async()=>({items:[{id:'test',location_code:'TEST01',updated_at:'2026-11-15T12:00:00Z'}],total:7})});
 assert.equal(result.issues.ok&&result.issues.data.length,5);assert.equal(result.counts.ok&&result.counts.data.total,7);
});
test("overview reuses corrected findings: zero, missing SKU and multiple valid placements are normal",()=>{
 const product={id:'p',sku:null,product_name:'Vare',variant_name:null};
 const location={id:'l',code:'TEST01',active:true,zone_id:'z',zones:{id:'z',code:'TEST'}};
 const rows=[{id:'a',product_id:'p',quantity:0,location_id:null,zone_id:null},{id:'b',product_id:'p',quantity:2,location_id:'l',zone_id:'z'},{id:'c',product_id:'p',quantity:3,location_id:'l',zone_id:'z'}];
 assert.equal(inventoryIssues([product],rows,[location]).list.length,0);
 assert.equal(inventoryIssues([product],[...rows,{...rows[0],id:'d',quantity:2}],[location]).list.length,1);
});
test("incomplete paginated issue reads never become a zero-finding result",async()=>{
 let calls=0;
 await assert.rejects(readAllIssuePages(async()=>++calls===1?{data:Array(500).fill({}),error:null}:{data:null,error:'denied'}));
 assert.equal(calls,2);
});
test("server overview authorizes before reads and retains existing Viper scope",()=>{
 const source=readFileSync('lib/warehouse-overview/read.ts','utf8');
 assert.match(source,/requireRole\(\["admin", "user", "warehouse"\]\)/);
 assert.ok(source.indexOf('if (!auth.ok)')<source.indexOf('await collectOverview'));
 assert.match(source,/const client = auth.authClient/);
 assert.match(source,/getViperQueue\(\{ id: auth.user.id/);
 assert.match(source,/\.eq\("status", "active"\)/);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.delete\(|\.rpc\(|shopify\/order-client/);
 assert.doesNotMatch(source,/actor_email|actor_name|metadata/);
});
