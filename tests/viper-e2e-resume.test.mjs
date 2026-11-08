import test from 'node:test';
import assert from 'node:assert/strict';
import {assertResume,RESUME_JOB,RESUME_ORDER} from '../scripts/viper/e2e.mjs';
import {rows,zone,ORDER_ID,PROJECT} from '../scripts/viper/e2e-manifest.mjs';
const config={project:PROJECT,url:`https://${PROJECT}.supabase.co`,anonKey:'sb_publishable_mock',serviceKey:'sb_secret_mock'};
const source={id:ORDER_ID,name:'#1001',updatedAt:'2026-11-05T21:03:22Z',cancelledAt:null,closed:false,fulfillable:true,displayFinancialStatus:'PAID',displayFulfillmentStatus:'UNFULFILLED',lineItems:{pageInfo:{hasNextPage:false},nodes:rows.map(r=>({id:r.externalLineId,variant:{id:r.product.shopify_variant_id,sku:r.product.sku},sku:r.product.sku,requiresShipping:true,unfulfilledQuantity:1}))}};
function fixture(){return {zones:[zone],products:rows.map(r=>r.product),locations:rows.map(r=>r.location),inventory:rows.map(r=>r.inventory),orders:[{id:RESUME_ORDER,source:'shopify',order_number:'#1001',status:'picking',picked_at:null,external_updated_at:source.updatedAt}],pick_jobs:[{id:RESUME_JOB,order_id:RESUME_ORDER,status:'in_progress',version:6,completed_at:null,started_at:'2026-11-07T14:35:18Z',assigned_to:'actor'}],profiles:[{id:'actor'}],pick_lines:rows.map((r,i)=>({id:'line'+i,pick_job_id:RESUME_JOB,sequence_number:i+1,order_line_id:'ol'+i,product_id:r.product.id,location_id:r.location.id,inventory_id:r.inventory.id,status:'picked',expected_quantity:1,picked_quantity:1,picked_by:'actor'})),order_lines:rows.map((r,i)=>({id:'ol'+i,external_line_id:r.externalLineId,product_id:r.product.id,requested_quantity:1}))};}
function reader(data){return async(url,options)=>{assert.ok(url.startsWith(config.url+'/rest/v1/'));assert.equal(options.method,undefined);assert.equal(options.redirect,'error');return {ok:true,json:async()=>data[new URL(url).pathname.split('/').at(-1)]};};}
test('resume accepts exact existing state using GET only',async()=>{await assertResume(config,source,reader(fixture()));});
for(const [name,mutate] of Object.entries({wrongJob:d=>d.pick_jobs[0].id='other',wrongVersion:d=>d.pick_jobs[0].version=7,wrongStock:d=>d.inventory[0].quantity=9,wrongOrder:d=>d.orders[0].id='other',completed:d=>d.pick_jobs[0].completed_at='2026-11-08',pending:d=>d.pick_lines[0].status='pending',wrongLink:d=>d.pick_lines[0].inventory_id='other',otherActive:d=>d.pick_jobs.push({...d.pick_jobs[0],id:'other'}),wrongActor:d=>d.profiles[0].id='other',sourceChanged:d=>d.orders[0].external_updated_at='2026-11-06T00:00:00Z',missingLine:d=>d.pick_lines.pop()})) {
 test(`resume rejects ${name}`,async()=>{const d=structuredClone(fixture());mutate(d);await assert.rejects(assertResume(config,source,reader(d)));});
}
test('wrong database or order identity rejected before network',async()=>{
 const noNetwork=()=>{assert.fail('Unexpected network');};
 await assert.rejects(assertResume({...config,project:'production'},source,noNetwork));
 await assert.rejects(assertResume(config,{...source,id:'other'},noNetwork));
});
