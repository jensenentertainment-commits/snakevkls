import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {rows,zone,ORDER_ID,SHOP,SHOP_ID,assertOrder} from '../scripts/viper/e2e-manifest.mjs';
import {authenticate,shopQuery,assertIdentity,adaptClient,proxySource,assertSeed} from '../scripts/viper/e2e.mjs';
import {seedSQL} from '../scripts/viper/e2e-seed-plan.mjs';
import {childEnvironment} from '../scripts/viper/preview.mjs';
const order=()=>({id:ORDER_ID,name:'#1001',cancelledAt:null,closed:false,fulfillable:true,displayFinancialStatus:'PAID',displayFulfillmentStatus:'UNFULFILLED',lineItems:{pageInfo:{hasNextPage:false},nodes:rows.map(r=>({id:r.externalLineId,variant:{id:r.product.shopify_variant_id,sku:r.product.sku},sku:r.product.sku,unfulfilledQuantity:1,requiresShipping:true}))}});
test('manifest has five separate products, null SKUs, ordered PICK locations and 50 -> 45 units',()=>{
 assert.equal(rows.length,5);assert.equal(rows.filter(r=>r.product.sku===null).length,2);assert.equal(zone.pick_priority,201);
 assert.equal(new Set(rows.flatMap(r=>[r.product.id,r.inventory.id,r.location.id])).size,15);
 rows.forEach((r,i)=>{assert.equal(r.location.pick_sequence,i+1);assert.equal(r.location.location_purpose,'PICK');assert.equal(r.inventory.quantity,10);assert.equal(r.expectedQuantity,9);assert.equal(r.inventory.product_id,r.product.id);assert.equal(r.inventory.location_id,r.location.id);});
});
test('order manifest accepts approved order and fails changed identity, quantity, SKU or missing variant',()=>{
 assert.doesNotThrow(()=>assertOrder(order()));
 for(const change of [o=>o.id='wrong',o=>o.lineItems.nodes[0].unfulfilledQuantity=2,o=>o.lineItems.nodes[0].variant.sku='wrong',o=>o.lineItems.nodes[0].variant=null,o=>o.lineItems.nodes.pop(),o=>o.closed=true]){const o=order();change(o);assert.throws(()=>assertOrder(o));}
});
test('authentication is pinned, redirects prohibited, write scopes rejected',async()=>{
 const config={shop:SHOP,shopId:SHOP_ID,clientId:'a'.repeat(32),clientSecret:'mock-only'};
 await assert.rejects(authenticate({...config,shop:'other.myshopify.com'},()=>{throw Error('must not call')}));
 await assert.rejects(authenticate(config,async(url,init)=>{assert.equal(url,`https://${SHOP}/admin/oauth/access_token`);assert.equal(init.redirect,'error');return {ok:true,json:async()=>({scope:'read_orders,read_products,write_orders',access_token:'mock',expires_in:86400})};}));
});
test('identity requires exact shop and app plus exact scopes',()=>{
 const i={shop:{id:SHOP_ID,myshopifyDomain:SHOP},currentAppInstallation:{app:{title:'Viper Read Test',apiKey:'test'},accessScopes:[{handle:'read_orders'},{handle:'read_products'}]}};
 assert.doesNotThrow(()=>assertIdentity(i,'test'));assert.throws(()=>assertIdentity(i,'other'));i.shop.id='other';assert.throws(()=>assertIdentity(i,'test'));
});
test('Shopify helper rejects mutations before network',async()=>{await assert.rejects(shopQuery('mock','mutation { x }',{},()=>{throw Error('network forbidden')}));});
test('environment drops production integrations and TLS overrides',()=>{
 const env=childEnvironment({SHOPIFY_ACCESS_TOKEN:'production',NODE_TLS_REJECT_UNAUTHORIZED:'0',DATABASE_URL:'production'},{project:'mvwpbscexvnfavxhbexb',url:'https://mvwpbscexvnfavxhbexb.supabase.co',anonKey:'sb_publishable_mock',serviceKey:'sb_secret_mock'});
 assert.equal(env.DATABASE_URL,undefined);assert.equal(env.SHOPIFY_ACCESS_TOKEN,undefined);assert.equal(env.NODE_TLS_REJECT_UNAUTHORIZED,undefined);assert.equal(env.ROY_PHASE2A_ENABLED,'false');
});
test('copy adapter preserves actual query and fences order, project, expiry',()=>{
 const s=readFileSync('lib/viper/shopify/order-client.ts','utf8');const out=adaptClient(s);
 assert.equal(out.match(/const ORDER_PREVIEW_QUERY = `([^`]+)`;/)[1],s.match(/const ORDER_PREVIEW_QUERY = `([^`]+)`;/)[1]);
 assert.ok(out.includes(ORDER_ID));assert.ok(out.includes('VIPER_E2E_EXPIRES'));assert.ok(!out.includes('.from("shopify_connections")'));assert.ok(out.includes('redirect: "error"'));
 assert.throws(()=>adaptClient('unexpected source'));
 for(const source of [out,proxySource])assert.equal(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022},reportDiagnostics:true}).diagnostics.length,0);
});
test('proxy protects existing jobs, denies other APIs and restricts browser origin',()=>{
 assert.ok(proxySource.includes("request.method!=='POST'"));assert.ok(proxySource.includes("request.headers.get('origin')"));assert.ok(proxySource.includes("o?.external_order_id!==orderId"));assert.ok(proxySource.includes("o.source!=='shopify'"));assert.ok(proxySource.includes('if(!pick&&!line)return deny()'));
});
test('review SQL requires system identity and explicit approval, no upsert/reset, rollback default',()=>{
 const sql=seedSQL();assert.ok(sql.includes('7702071863184491885'));assert.ok(sql.includes("current_setting('viper.e2e_approval',true)"));assert.ok(sql.includes('SHARE ROW EXCLUSIVE'));assert.ok(sql.includes('ROLLBACK;'));assert.ok(!/\b(COMMIT|UPDATE|DELETE|TRUNCATE)\b/.test(sql));assert.equal((sql.match(/INSERT INTO public.products/g)||[]).length,5);
});
test('generated proxy executes fail-closed for other orders/jobs/origins and allows pinned order',async()=>{
 let external=ORDER_ID;
 class Response {constructor(body,init){this.status=init.status;}static next(){return {status:200};}}
 const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{orders:{source:'shopify',external_order_id:external}}})})})})};
 const context={exports:{},process:{env:{VIPER_E2E_EXPIRES:String(Date.now()+60000)}},require:name=>name==='next/server'?{NextResponse:Response}:name.includes('admin')?{getSupabaseAdmin:()=>db}:{updateSession:()=>({status:200})}};
 vm.runInNewContext(ts.transpileModule(proxySource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const req=(path,id=ORDER_ID,origin='http://localhost:3000')=>({method:'POST',nextUrl:{pathname:path},headers:new Map([['host','localhost:3000'],['origin',origin]]),clone:()=>({json:async()=>({orderId:id})})});
 const proxy=context.exports.proxy;
 assert.equal((await proxy(req('/api/viper/shopify/orders/import'))).status,200);
 assert.equal((await proxy(req('/api/viper/shopify/orders/import','other'))).status,403);
 assert.equal((await proxy(req('/api/viper/shopify/orders/import',ORDER_ID,'https://evil.test'))).status,403);
 assert.equal((await proxy(req('/api/cron/shopify-sync'))).status,403);
 assert.equal((await proxy(req('/api/viper/picks/aaaa/start'))).status,200);
 const get=req('/api/viper/picks/3974c454-a1cc-47ca-ad57-94d3ef1f7f10');get.method='GET';get.headers.delete('origin');
 assert.equal((await proxy(get)).status,200);
 assert.equal((await proxy({...get,method:'HEAD'})).status,403);
 assert.equal((await proxy({...get,method:'PUT'})).status,403);
 assert.equal((await proxy({...get,nextUrl:{pathname:'/api/viper/picks/other'}})).status,403);
 assert.equal((await proxy({...get,nextUrl:{pathname:'/api/viper/shopify/orders/preview'}})).status,403);
 get.headers.set('sec-fetch-site','cross-site');assert.equal((await proxy(get)).status,403);get.headers.delete('sec-fetch-site');
 external='other';assert.equal((await proxy(req('/api/viper/picks/aaaa/start'))).status,403);
 assert.equal((await proxy(get)).status,403);
});
test('seed preflight rejects previously imported order and extra inventory',async()=>{
 const c={url:'https://mvwpbscexvnfavxhbexb.supabase.co',serviceKey:'sb_secret_mock'};
 let existing=false,extra=false;
 const request=async url=>({ok:true,json:async()=>{
  const table=url.split('/rest/v1/')[1].split('?')[0];
  if(table==='zones')return [zone];
  if(table==='products')return rows.map(r=>r.product);
  if(table==='locations')return rows.map(r=>r.location);
  if(table==='inventory')return [...rows.map(r=>r.inventory),...(extra?[{id:'unexpected'}]:[])];
  if(table==='profiles')return [{id:'actor'}];
  if(table==='orders')return existing?[{id:'previous'}]:[];
  return [];
 }});
 await assertSeed(c,request);existing=true;await assert.rejects(assertSeed(c,request));existing=false;extra=true;await assert.rejects(assertSeed(c,request));
});
