import {test} from 'node:test';
import assert from 'node:assert/strict';
import {run,checkConfig,checkScopes,orderQuery,SHOP,SHOP_ID} from '../scripts/viper/shopify-read-test.mjs';
const config={shop:SHOP,shopId:SHOP_ID,clientId:'a'.repeat(32),clientSecret:'synthetic-secret'};
const identity={data:{shop:{id:SHOP_ID,myshopifyDomain:SHOP},currentAppInstallation:{accessScopes:[{handle:'read_orders'},{handle:'read_products'}]}}};
const auth={access_token:'synthetic-token',scope:'read_products,read_orders'};
function mock(responses,calls){return async(url,options)=>{calls.push({url,...options});assert.ok(responses.length);return {ok:true,json:async()=>responses.shift()};};}
test('read test rejects wrong target and broader/missing scopes',()=>{
 assert.throws(()=>checkConfig({...config,shop:'other.myshopify.com'}));
 assert.throws(()=>checkConfig({...config,shopId:'other'}));
 assert.throws(()=>checkScopes(['read_products']));
 assert.throws(()=>checkScopes(['read_products','read_orders','write_products']));
 assert.match(orderQuery(),/query ViperOrderPreview/);
});
test('bounded read flow uses pinned HTTPS and never logs credentials',async()=>{
 const calls=[],logs=[];
 await run(config,mock([auth,identity,{data:{products:{nodes:[],pageInfo:{hasNextPage:false}}}},{data:{orders:{nodes:[]}}}],calls),x=>logs.push(x));
 assert.equal(calls.length,4);
 for(const c of calls){assert.equal(new URL(c.url).hostname,SHOP);assert.equal(c.redirect,'error');assert.doesNotMatch(c.body,/\bmutation\b/);}
 assert.match(logs.join(''),/NOT TESTED/);
 assert.doesNotMatch(logs.join(''),/synthetic-secret|synthetic-token/);
});
test('unexpected scopes stop before resource queries without raw error',async()=>{
 const calls=[];
 await assert.rejects(run(config,mock([{...auth,scope:'write_products'}],calls),()=>{}),/authentication/);
 assert.equal(calls.length,1);
});
test('wrong live identity stops before products/orders',async()=>{
 const calls=[];
 await assert.rejects(run(config,mock([auth,{data:{...identity.data,shop:{id:'wrong',myshopifyDomain:SHOP}}}],calls),()=>{}),/identity\/scopes/);
 assert.equal(calls.length,2);
});
test('only confirmed test order reaches exact Viper query',async()=>{
 const calls=[],logs=[];
 const candidate={id:'gid://shopify/Order/1',test:true,cancelledAt:null,closed:false,fulfillable:true,displayFinancialStatus:'PAID',displayFulfillmentStatus:'UNFULFILLED'};
 await run(config,mock([auth,identity,{data:{products:{nodes:[]}}},{data:{orders:{nodes:[{...candidate,id:'real',test:false},candidate]}}},{data:{order:{id:candidate.id,test:true}}},{data:{order:{id:candidate.id,lineItems:{nodes:[],pageInfo:{hasNextPage:false}}}}}],calls),x=>logs.push(x));
 assert.equal(JSON.parse(calls.at(-1).body).query,orderQuery());
 assert.equal(JSON.parse(calls.at(-1).body).variables.id,candidate.id);
 assert.match(logs.at(-1),/PASS/);
});
