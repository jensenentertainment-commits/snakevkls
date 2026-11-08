// Separate integration harness. Never imports environment files or seeds data.
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {validateConfig,verify,childEnvironment,createWorkspace} from './preview.mjs';
import {checkConfig,checkScopes,orderQuery} from './shopify-read-test.mjs';
import {PROJECT,SHOP,SHOP_ID,ORDER_ID,rows,zone,assertOrder} from './e2e-manifest.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');

export async function authenticate(c,request=fetch) {
  checkConfig(c);
  const response=await request(`https://${SHOP}/admin/oauth/access_token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:c.clientId,client_secret:c.clientSecret})});
  if(!response.ok)throw new Error('Authentication failed');
  const a=await response.json(); checkScopes(String(a.scope??'').split(',').map(s=>s.trim()));
  if(!a.access_token || !Number.isFinite(a.expires_in) || a.expires_in<600)throw new Error('Token unavailable/too short-lived');
  return {token:a.access_token,expires:Date.now()+Math.min(a.expires_in*1000,2*60*60*1000)};
}
export async function shopQuery(token,query,variables={},request=fetch) {
  if(/\bmutation\b/i.test(query))throw new Error('Mutations prohibited');
  const r=await request(`https://${SHOP}/admin/api/2026-04/graphql.json`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json','X-Shopify-Access-Token':token},body:JSON.stringify({query,variables})});
  if(!r.ok)throw new Error('Shopify request failed');
  const p=await r.json();if(p.errors?.length)throw new Error('Shopify query failed');return p.data;
}
export function assertIdentity(i,clientId) {
  if(i?.shop?.id!==SHOP_ID || i.shop.myshopifyDomain!==SHOP || i.currentAppInstallation?.app?.title!=='Viper Read Test' || i.currentAppInstallation.app.apiKey!==clientId)throw new Error('Shop/app mismatch');
  checkScopes(i.currentAppInstallation.accessScopes.map(s=>s.handle));
}
const identityQuery='query { shop { id myshopifyDomain } currentAppInstallation { app { title apiKey } accessScopes { handle } } }';

// Only the disposable copy's credential adapter is substituted. Query, source
// validation, materialization, command handling and SQL remain production code.
export function adaptClient(source) {
  const start=source.indexOf('  const { data: connection, error } = await getSupabaseAdmin()');
  const end=source.indexOf('  const response = await fetch(',start);
  if(start<0 || end<0 || !source.includes('variables: { id: orderId }'))throw new Error('Unknown source client');
  const guard=`  if (shop !== '${SHOP}' || orderId !== '${ORDER_ID}' || process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://${PROJECT}.supabase.co' || Date.now() >= Number(process.env.VIPER_E2E_EXPIRES ?? 0)) throw new ShopifyOrderClientError('Isolert test sperret.', 'SHOPIFY_ERROR');
  const connection = {access_token:process.env.VIPER_E2E_TOKEN};
  if (!connection.access_token) throw new ShopifyOrderClientError('Test-token mangler.', 'SHOPIFY_ERROR');
`;
  return (source.slice(0,start)+guard+source.slice(end)).replace('import { getSupabaseAdmin } from "@/lib/supabase/admin";','').replace('method: "POST",','method: "POST",\n      redirect: "error",');
}

export const proxySource=String.raw`import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';
import {updateSession} from './lib/supabase/proxy';
import {getSupabaseAdmin} from './lib/supabase/admin';
const orderId='${ORDER_ID}';
export async function proxy(request:NextRequest) {
 const p=request.nextUrl.pathname;
 const deny=()=>new NextResponse('Isolert ordre #1001: handling sperret',{status:403});
 if(!['localhost:3000','127.0.0.1:3000'].includes(request.headers.get('host')??''))return deny();
 if(p.startsWith('/api/')) {
  if(Date.now()>=Number(process.env.VIPER_E2E_EXPIRES??0))return deny();
  if(request.method==='GET' && p==='/api/viper/picks/3974c454-a1cc-47ca-ad57-94d3ef1f7f10') {
   const origin=request.headers.get('origin');
   if((origin && !['http://localhost:3000','http://127.0.0.1:3000'].includes(origin)) || request.headers.get('sec-fetch-site')==='cross-site')return deny();
   const j=await getSupabaseAdmin().from('pick_jobs').select('orders!inner(external_order_id,source)').eq('id','3974c454-a1cc-47ca-ad57-94d3ef1f7f10').maybeSingle();
   const o=j.data?.orders as unknown as {external_order_id:string;source:string}|undefined;
   if(j.error||o?.external_order_id!==orderId||o.source!=='shopify')return deny();
   return NextResponse.next(); // Existing GET handler still enforces authentication/role.
  }
  if(request.method!=='POST' || !['http://localhost:3000','http://127.0.0.1:3000'].includes(request.headers.get('origin')??''))return deny();
  if(/^\/api\/viper\/shopify\/orders\/(preview|import)$/.test(p)) {
   const b=await request.clone().json().catch(()=>null);
   if(![orderId,'18982115672316'].includes(b?.orderId))return deny();
   return NextResponse.next();
  }
  const pick=p.match(/^\/api\/viper\/picks\/([0-9a-f-]+)\/(start|complete|cancel)$/);
  const line=p.match(/^\/api\/viper\/pick-lines\/([0-9a-f-]+)\/(confirm|undo|exceptions)$/);
  if(!pick&&!line)return deny();
  const db=getSupabaseAdmin();let jobId=pick?.[1];
  if(line){const r=await db.from('pick_lines').select('pick_job_id').eq('id',line[1]).maybeSingle();if(r.error||!r.data)return deny();jobId=r.data.pick_job_id;}
  const j=await db.from('pick_jobs').select('orders!inner(external_order_id,source)').eq('id',jobId!).maybeSingle();
  const o=j.data?.orders as unknown as {external_order_id:string;source:string}|undefined;
  if(j.error||o?.external_order_id!==orderId||o.source!=='shopify')return deny();
  return NextResponse.next();
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return deny();
 if(p.startsWith('/_next/')||p==='/favicon.ico')return NextResponse.next();
 if(p==='/'||p==='/dashboard')return NextResponse.redirect(new URL('/viper',request.url));
 if(p!=='/login'&&p!=='/viper'&&!p.startsWith('/viper/'))return deny();
 return updateSession(request);
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
`;

export async function assertSeed(c,request=fetch) {
 const get=async(path)=>{
  const k=c.serviceKey;
  const r=await request(c.url+'/rest/v1/'+path,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:k,...(k.startsWith('eyJ')?{Authorization:`Bearer ${k}`}:{})}});
  if(!r.ok)throw new Error('Fixture read failed');return r.json();
 };
 for(const [table,expected] of [['zones',[zone]],['products',rows.map(r=>r.product)],['locations',rows.map(r=>r.location)],['inventory',rows.map(r=>r.inventory)]]) {
  const actual=await get(`${table}?select=*&id=in.(${expected.map(r=>r.id).join(',')})`);
  if(actual.length!==expected.length || expected.some(e=>!actual.some(a=>Object.entries(e).every(([k,v])=>a[k]===v))))throw new Error('Fixture absent/changed; no automatic reseed');
 }
 const existing=await get(`orders?select=id&external_order_id=eq.${encodeURIComponent(ORDER_ID)}`);
 const active=await get('pick_jobs?select=id&status=eq.in_progress');
 const inventories=await get(`inventory?select=id&product_id=in.(${rows.map(r=>r.product.id).join(',')})`);
 const profiles=await get('profiles?select=id&email=eq.viper-ui%40example.test&role=eq.admin&active=eq.true');
 if(existing.length||active.length||inventories.length!==5||profiles.length!==1)throw new Error('Existing run or unexpected fixture requires explicit recovery review');
}

export const RESUME_JOB='3974c454-a1cc-47ca-ad57-94d3ef1f7f10';
export const RESUME_ORDER='0d3c414c-b7c3-478d-98ac-77bcad9f5558';
export async function assertResume(c,sourceOrder,request=fetch) {
 validateConfig(c);assertOrder(sourceOrder);
 const get=async path=>{
  const k=c.serviceKey;
  const r=await request(c.url+'/rest/v1/'+path,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:k,...(k.startsWith('eyJ')?{Authorization:`Bearer ${k}`}:{})}});
  if(!r.ok)throw new Error('Resume read failed');return r.json();
 };
 for(const [table,expected] of [['zones',[zone]],['products',rows.map(r=>r.product)],['locations',rows.map(r=>r.location)],['inventory',rows.map(r=>r.inventory)]]) {
  const actual=await get(`${table}?select=*&id=in.(${expected.map(r=>r.id).join(',')})`);
  if(actual.length!==expected.length||expected.some(e=>!actual.some(a=>Object.entries(e).every(([k,v])=>a[k]===v))))throw new Error('Resume manifest mismatch');
 }
 const orders=await get(`orders?select=*&external_order_id=eq.${encodeURIComponent(ORDER_ID)}`);
 const o=orders[0];
 if(orders.length!==1||o.id!==RESUME_ORDER||o.source!=='shopify'||o.order_number!=='#1001'||o.status!=='picking'||o.picked_at!==null||!Number.isFinite(Date.parse(o.external_updated_at))||Date.parse(o.external_updated_at)!==Date.parse(sourceOrder.updatedAt))throw new Error('Resume order mismatch');
 const jobs=await get(`pick_jobs?select=*&order_id=eq.${RESUME_ORDER}`);
 const j=jobs[0];
 if(jobs.length!==1||j.id!==RESUME_JOB||j.order_id!==RESUME_ORDER||j.status!=='in_progress'||j.version!==6||j.completed_at!==null||!j.started_at)throw new Error('Resume job mismatch');
 const active=await get('pick_jobs?select=id&status=eq.in_progress');
 if(active.length!==1||active[0].id!==RESUME_JOB)throw new Error('Other active job');
 const profiles=await get('profiles?select=id&email=eq.viper-ui%40example.test&role=eq.admin&active=eq.true');
 if(profiles.length!==1||profiles[0].id!==j.assigned_to)throw new Error('Resume actor mismatch');
 const lines=await get(`pick_lines?select=*&pick_job_id=eq.${RESUME_JOB}`);
 const orderLines=await get(`order_lines?select=*&order_id=eq.${RESUME_ORDER}`);
 if(lines.length!==5||orderLines.length!==5)throw new Error('Resume line count');
 for(const [i,row] of rows.entries()) {
  const l=lines.find(l=>l.sequence_number===i+1);
  const ol=orderLines.find(ol=>ol.external_line_id===row.externalLineId);
  if(!l||!ol||l.pick_job_id!==RESUME_JOB||l.order_line_id!==ol.id||ol.product_id!==row.product.id||ol.requested_quantity!==1||l.product_id!==row.product.id||l.location_id!==row.location.id||l.inventory_id!==row.inventory.id||l.status!=='picked'||l.expected_quantity!==1||l.picked_quantity!==1||l.picked_by!==j.assigned_to)throw new Error('Resume line mismatch');
 }
 const inventory=await get(`inventory?select=id&product_id=in.(${rows.map(r=>r.product.id).join(',')})`);
 if(inventory.length!==5)throw new Error('Additional inventory');
 console.log('Resume verified: pinned job, version 6, five picked lines, stock 50; read-only checks.');
}

async function main() {
 const mode=process.argv[2];
 if(!['--verify','--start-approved','--resume-approved'].includes(mode))throw new Error('Explicit mode required');
 let text='';for await(const chunk of process.stdin){text+=chunk;if(text.length>25000)throw new Error('Oversized input');}
 const c=JSON.parse(text);text='';validateConfig(c.database);
 await verify(c.database); // Both keys, pinned HTTPS host, schema; zero Shopify connections.
 const auth=await authenticate(c.shopify);c.shopify.clientSecret=undefined;
 const identity=await shopQuery(auth.token,identityQuery);assertIdentity(identity,c.shopify.clientId);
 const metadata=(await shopQuery(auth.token,'query($id: ID!) { order(id:$id) { id test } }',{id:ORDER_ID})).order;
 if(metadata?.id!==ORDER_ID || metadata.test!==false)throw new Error('Unexpected order test flag');
 const order=(await shopQuery(auth.token,orderQuery(),{id:ORDER_ID})).order;assertOrder(order);
 console.log('Pinned project/shop/app/scopes/order manifest verified. No database writes.');
 if(mode==='--verify')return;
 if(mode==='--resume-approved')await assertResume(c.database,order);
 else await assertSeed(c.database);
 await new Promise((ok,fail)=>{const s=net.createServer();s.once('error',fail);s.listen(3000,'127.0.0.1',()=>s.close(ok));});
 const workspace=createWorkspace(root,join(process.env.LOCALAPPDATA,'SnakeViperE2E','workspaces'));
 const client=join(workspace,'lib/viper/shopify/order-client.ts');
 writeFileSync(client,adaptClient(readFileSync(client,'utf8')));
 writeFileSync(join(workspace,'proxy.ts'),proxySource);
 const layout=join(workspace,'app/layout.tsx');
 writeFileSync(layout,readFileSync(layout,'utf8').replace('SNAKE-TEST · Kun syntetiske Viper-data · Ingen produksjonsintegrasjoner','SNAKE-TEST · JensenDigital #1001 · Shopify kun lesing · IKKE produksjon'));
 const env={...childEnvironment(process.env,c.database),VIPER_SHOPIFY_IMPORT_ENABLED:'true',SHOPIFY_STORE_DOMAIN:SHOP,SHOPIFY_API_VERSION:'2026-04',VIPER_E2E_TOKEN:auth.token,VIPER_E2E_EXPIRES:String(auth.expires)};
 const child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3000'],{cwd:workspace,env,stdio:'inherit',windowsHide:true});
 console.log('Isolated #1001 only: http://localhost:3000/login?next=/viper — Ctrl+C stops; no seeding/cleanup is automatic.');
 const timer=setTimeout(()=>child.kill(),Math.max(1,auth.expires-Date.now()));
 child.on('error',()=>{clearTimeout(timer);process.exitCode=1;});child.on('exit',code=>{clearTimeout(timer);process.exitCode=code??1;});
 process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{console.error('E2E stopped: configuration, identity, order, fixture or port guard failed. No fallback/retry; secrets withheld.');process.exitCode=1;});
