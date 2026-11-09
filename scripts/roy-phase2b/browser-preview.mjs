// Isolated test workspace + real SQL RPCs inside ONE rolled-back local transaction.
// Synthetic auth transport and model response only. Never loads .env or remote keys.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
if (process.argv[2]!=='--approved') throw new Error('Explicit isolated preview approval required');
const root=fileURLToPath(new URL('../../',import.meta.url));
const workspace=mkdtempSync(join(tmpdir(),'snake-roy-2b-ui-'));
const env={};for(const [k,v] of Object.entries(process.env)) if(/^(systemroot|windir|comspec|path|pathext|temp|tmp|userprofile|localappdata|appdata)$/i.test(k)) env[k]=v;
const psql=spawn('C:/Users/jense/AppData/Local/SnakeViperValidation/tools/pgsql/bin/psql.exe',
  ['-X','-w','-q','-A','-t','-h','127.0.0.1','-p','55433','-U','snake_catalog_test','-d','snake_phase2a_test_catalogfresh','-v','ON_ERROR_STOP=1'],
  {cwd:root,env:{...env,PGSSLMODE:'disable',PGPASSFILE:'C:/Users/jense/AppData/Local/SnakeCatalogValidation/pgpass.conf'},stdio:['pipe','pipe','pipe'],windowsHide:true});
let output='',pending,serial=Promise.resolve(),sequence=0;
psql.stdout.on('data',d=>{output+=d;if(pending&&output.includes(pending.marker)){const p=pending;pending=null;clearTimeout(p.timer);const result=output.slice(0,output.indexOf(p.marker)).trim();output='';p.resolve(result);}});
psql.stderr.on('data',d=>console.error(String(d)));
psql.on('exit',code=>{if(pending){clearTimeout(pending.timer);pending.reject(new Error('Local psql stopped '+code));pending=null;}});
function sql(text){const task=serial.then(()=>new Promise((resolve,reject)=>{const marker='UI_DONE_'+(++sequence);const timer=setTimeout(()=>reject(new Error('SQL timeout')),15000);pending={marker,timer,resolve,reject};psql.stdin.write(text+'\n\\echo '+marker+'\n');}));serial=task.catch(()=>{});return task;}
const guard=readFileSync(join(root,'tests/database/roy-phase-2a-acceptance.guard.sql'),'utf8');
const migration=readFileSync(join(root,'supabase/migrations/20261109191325_roy_catalog_review.sql'),'utf8');
const roles={admin:'97000000-0000-4000-8000-000000000201',user:'97000000-0000-4000-8000-000000000202'};
await sql(`begin; set local snake.phase2a_isolated='on'; ${guard}
do $$ begin
 if current_setting('server_version') not like '17.11%' or to_regclass('public.roy_review_runs') is not null then raise exception 'Preview baseline mismatch'; end if;
 if exists(select 1 from public.shopify_connections where shop<>'fixture.myshopify.com') or (select count(*) from public.shopify_connections)<>1 then raise exception 'Synthetic shop mismatch'; end if;
end $$;
${migration}
insert into auth.users(id) values('${roles.admin}'),('${roles.user}');
insert into public.profiles(id,email,role,display_name,active) values('${roles.admin}','roy-ui-admin@example.test','admin','Roy testadmin',true),('${roles.user}','roy-ui-user@example.test','user','Roy testbruker',true);
insert into public.products(shopify_product_id,shopify_variant_id,product_name,sku,active)
select 'gid://shopify/Product/'||(9793000+n),'gid://shopify/ProductVariant/'||(9793000+n),case n when 1 then 'A – Syntetiske ullvotter' when 2 then 'B – Syntetisk lue' else 'Syntetisk testvare '||n end,null,true from generate_series(1,8)n;
insert into public.shopify_product_content(shopify_product_id,product_name,description,product_handle,shopify_status,shopify_updated_at,content_observed_at,synced_at,collections_complete,collections_observed_at,image_url)
select shopify_product_id,product_name,case when shopify_product_id='gid://shopify/Product/9793001' then '' else 'Syntetisk beskrivelse' end,'ui-'||shopify_variant_id,'ACTIVE',now(),now(),now(),true,now(),case when shopify_product_id in ('gid://shopify/Product/9793001','gid://shopify/Product/9793002') then null else 'https://example.test/image.png' end
from public.products where shopify_product_id like 'gid://shopify/Product/979300%';
create function pg_temp.ui_rpc(n text,a jsonb) returns jsonb language plpgsql as $$ declare d jsonb; begin
 case n
 when 'get_roy_review_v1' then d:=public.get_roy_review_v1(coalesce((a->>'requested_offset')::int,0),(a->>'requested_run')::uuid);
 when 'run_roy_review_v1' then d:=to_jsonb(public.run_roy_review_v1((a->>'request_id')::uuid));
 when 'get_roy_catalog_foundation_v1' then d:=public.get_roy_catalog_foundation_v1();
 else raise exception 'RPC not permitted'; end case;
 return jsonb_build_object('data',d,'error',null);
 exception when others then return jsonb_build_object('data',null,'error',jsonb_build_object('code',sqlstate,'message','Synthetic local RPC rejected'));
end $$;`);
const key=randomBytes(32).toString('hex');
const tokens={admin:randomUUID(),user:randomUUID()};
function literal(v){return "'"+String(v).replaceAll("'","''")+"'";}
let stopped=false,next;
async function stop(){if(stopped)return;stopped=true;await sql('rollback;');psql.stdin.end('\\q\n');next?.kill();server.close();console.log('Preview stopped; migration and synthetic data rolled back.');}
const server=createServer(async(req,res)=>{
  try {
    if(req.headers['x-test-key']!==key){res.writeHead(403);res.end();return;}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>12000)throw new Error('Oversized');}
    const input=JSON.parse(body||'{}');
    const role=Object.keys(tokens).find(r=>tokens[r]===input.session);
    const actor=roles[role];
    let result;
    if(req.url==='/login'&&Object.hasOwn(tokens,input.role)) result={session:tokens[input.role]};
    else if(req.url==='/identity') result=actor?{user:{id:actor},profile:JSON.parse(await sql(`reset role; select jsonb_build_object('role',role,'active',active,'display_name',display_name) from public.profiles where id='${actor}';`))}:null;
    else if(req.url==='/rpc'&&actor&&['get_roy_review_v1','run_roy_review_v1','get_roy_catalog_foundation_v1'].includes(input.name)) {
      const raw=await sql(`select set_config('request.jwt.claim.sub','${actor}',true); set local role authenticated; select pg_temp.ui_rpc(${literal(input.name)},${literal(JSON.stringify(input.args??{}))}::jsonb); reset role;`);
      result=JSON.parse(raw.split('\n').filter(Boolean).at(-1));
    } else if(req.url==='/scenario'&&role==='admin') {
      const action={
        block:"insert into private.sync_runs(id,status,source) values('97000000-0000-4000-8000-000000000299','failed','manual');",
        unblock:"delete from private.sync_runs where id='97000000-0000-4000-8000-000000000299';",
        fix:"update public.shopify_product_content set description='Rettet syntetisk beskrivelse',image_url='https://example.test/image.png' where shopify_product_id='gid://shopify/Product/9793001';",
        reopen:"update public.shopify_product_content set description='' where shopify_product_id='gid://shopify/Product/9793001';",
      }[input.action];
      if(!action)throw new Error('Unknown scenario');await sql('reset role; '+action);result={ok:true};
    } else if(req.url==='/stop'){res.end('{}');await stop();return;}
    else {res.writeHead(403);res.end('{}');return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  } catch {res.writeHead(500);res.end('{"error":"Isolated adapter failed"}');}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(3032,'127.0.0.1',ok);});
function put(path,text){mkdirSync(join(workspace,path,'..'),{recursive:true});writeFileSync(join(workspace,path),text);}
for(const name of ['lib','types','public','package.json','package-lock.json','tsconfig.json','postcss.config.mjs','app/components','app/globals.css','app/shopify','app/api/roy']) cpSync(join(root,name),join(workspace,name),{recursive:true});
symlinkSync(join(root,'node_modules'),join(workspace,'node_modules'),'junction');
put('next.config.mjs',`export default {devIndicators:false};`);
put('app/layout.tsx',`import './globals.css'; export default function Layout({children}:{children:React.ReactNode}){return <html lang="nb"><body style={{background:"var(--snake-color-workspace)",color:"var(--snake-color-text-primary)"}} className="min-h-screen"><aside className="bg-snake-warning-surface p-3 text-center">LOKAL ROY-TEST · syntetiske data · testinnlogging · ingen eksterne integrasjoner</aside><nav className="p-3"><a href="/test-login">Testkontroller og bytt bruker</a></nav><div className="mx-auto max-w-7xl p-4 sm:p-8">{children}</div></body></html>}`);
put('lib/supabase/server.ts',`import 'server-only'; import {cookies} from 'next/headers';
async function transport(path:string,body:unknown){const r=await fetch('http://127.0.0.1:3032'+path,{method:'POST',headers:{'Content-Type':'application/json','x-test-key':process.env.ROY_TEST_KEY!},body:JSON.stringify(body),cache:'no-store'});if(!r.ok)throw new Error('Local adapter unavailable');return r.json();}
export async function createClient(){const session=(await cookies()).get('roy_test_session')?.value;const identity=await transport('/identity',{session});return {auth:{getUser:async()=>({data:{user:identity?.user??null},error:null})},from:(table:string)=>{if(table!=='profiles')throw new Error('Table blocked');return {select:()=>({eq:()=>({single:async()=>({data:identity?.profile??null,error:null})})})};},rpc:async(name:string,args?:unknown)=>transport('/rpc',{session,name,args})};}
`);
// Stub only external model transport; keep Roy route/provider/presenter intact.
let chat=readFileSync(join(workspace,'lib/intelligence/shared/chat-server.ts'),'utf8');
chat=chat.replace('import OpenAI from "openai";','').replace(/let openAIClient:[\s\S]*?return openAIClient;\s*}/,'export function getChatOpenAIClient(){return {responses:{create:async()=>({output_text:"Syntetisk modelltransport; ingen eksternt API-kall."})}};}');
if(chat.includes('new OpenAI'))throw new Error('Model adapter replacement failed');
put('lib/intelligence/shared/chat-server.ts',chat);
put('app/test-login/page.tsx',`'use client'; import {useState} from 'react'; export default function Test(){const [status,setStatus]=useState('');async function act(action:string){const r=await fetch('/api/test-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});setStatus('HTTP '+r.status);if(action==='admin'||action==='user')location.href='/shopify';}return <main><h1>Isolert Roy-test</h1>{['admin','user','block','unblock','fix','reopen'].map(a=><button style={{margin:8,padding:12,border:'1px solid'}} key={a} onClick={()=>act(a)}>{a}</button>)}<button onClick={async()=>{const r=await fetch('/api/roy/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID()})});setStatus('Direkte kontroll: HTTP '+r.status);}}>Test direkte kjøring med nåværende rolle</button><p role="status">{status}</p><a href="/shopify">Til Roy</a></main>}`);
put('app/api/test-control/route.ts',`import {cookies} from 'next/headers';import {NextResponse} from 'next/server'; export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return new Response('',{status:403});const {action}=await req.json();const jar=await cookies();const login=['admin','user'].includes(action);const r=await fetch('http://127.0.0.1:3032'+(login?'/login':'/scenario'),{method:'POST',headers:{'Content-Type':'application/json','x-test-key':process.env.ROY_TEST_KEY!},body:JSON.stringify(login?{role:action}:{session:jar.get('roy_test_session')?.value,action})});if(!r.ok)return new Response('',{status:r.status});const data=await r.json();if(login)jar.set('roy_test_session',data.session,{httpOnly:true,sameSite:'strict',path:'/'});return NextResponse.json({ok:true});}`);
put('proxy.ts',`import {NextResponse} from 'next/server';import type {NextRequest} from 'next/server';export function proxy(r:NextRequest){const p=r.nextUrl.pathname;const ok=p.startsWith('/_next/')||['/shopify','/test-login','/api/test-control','/api/roy/review','/api/roy/ask'].includes(p);if(!ok)return new NextResponse('Isolated test route blocked',{status:403});const out=NextResponse.next();out.headers.set('Content-Security-Policy',"connect-src 'self' ws://127.0.0.1:3031; img-src 'self' data:; frame-src 'none'");return out;}export const config={matcher:['/:path*']};`);
next=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3031'],{cwd:workspace,env:{...env,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',ROY_PHASE2A_ENABLED:'true',ROY_PHASE2B_ENABLED:'true',ROY_TEST_KEY:key,VIPER_SHOPIFY_IMPORT_ENABLED:'false'},stdio:'inherit',windowsHide:true});
next.on('exit',()=>{if(!stopped)void stop();});
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
console.log('Isolated preview: http://127.0.0.1:3031/test-login');
console.log('Workspace: '+workspace);
