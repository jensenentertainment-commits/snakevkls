import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { approval, assertReady, assertUuid, parseBackfillTarget, record, requireApproval, runProtectedBackfill, type BackfillRpc } from "../../lib/shopify/backfill-operation.ts";
import { proveBackfill, proofSummary } from "../../lib/shopify/backfill-proof.ts";

const commands=["plan","preflight","start","resume","inspect","preview","complete","proof"];
const help="Roy Phase 2A operator tooling (default read-only). Commands: plan/preflight, start, resume, inspect, preview, complete, proof. Read docs/roy-phase-2a-backfill.md before operator use. No environment files are loaded.";
export function parseArgs(args:string[]) {
  const command=args[0]?.startsWith("--")?"plan":args.shift()??"plan";
  if(!commands.includes(command)) throw new Error("Unknown command");
  const flags:Record<string,string>={};
  const allowed:Record<string,string[]>={plan:["target"],preflight:["target"],start:["target","operation","confirm"],resume:["target","operation","run","confirm","max-pages"],
    inspect:["target","operation"],preview:["target","operation"],complete:["target","operation","run","confirm","preview"],proof:["snapshot","format"]};
  while(args.length) {
    const key=args.shift()!,value=args.shift();
    if(!key.startsWith("--") || !allowed[command].includes(key.slice(2)) || value===undefined || value.startsWith("--") || Object.hasOwn(flags,key.slice(2))) throw new Error("Unknown, duplicate or valueless flag");
    flags[key.slice(2)]=value;
  }
  return {command,flags};
}
function jsonFile(path:string,max=65536):unknown {
  if(!path || statSync(path).size>max) throw new Error("Explicit bounded JSON file required");
  return JSON.parse(readFileSync(path,"utf8").replace(/^\uFEFF/,""));
}
function redacted(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(redacted);
  if(value && typeof value==="object") return Object.fromEntries(Object.entries(value).filter(([k])=>!/(token|secret|password)/i.test(k)).map(([k,v])=>[k,redacted(v)]));
  return value;
}
export async function main(args:string[]) {
  const {command,flags}=parseArgs([...args]);
  if(command==="proof") {
    if(flags.format && !["json","text"].includes(flags.format)) throw new Error("Proof format must be json or text");
    const report=proveBackfill(jsonFile(flags.snapshot,512*1024));
    console.log(flags.format==="text"?proofSummary(report):JSON.stringify(report,null,2));
    return report.status==="PASS"?0:2;
  }
  if(!flags.target && ["plan","preflight"].includes(command)) { console.log(help); return 0; }
  const target=parseBackfillTarget(jsonFile(flags.target));
  const operation=flags.operation;
  if(operation) assertUuid(operation);
  if(!["plan","preflight"].includes(command) && !operation) throw new Error("Explicit operation UUID required");
  const mutation=["start","resume","complete"].includes(command);
  let preview:Record<string,unknown>|undefined;
  // Validate confirmations and code/gate before even constructing a connection.
  if(mutation) {
    if(command==="complete") preview=record(jsonFile(flags.preview));
    requireApproval(flags.confirm,approval(command as "start"|"resume"|"complete",target,operation!,flags.run,preview?.affectedDigest as string|undefined));
    if(process.env.ROY_PHASE2A_ENABLED && process.env.ROY_PHASE2A_ENABLED!=="false") throw new Error("Local runtime gate must remain disabled");
    const revision=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
    if(revision!==target.codeRevision || execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim()) throw new Error("Target revision must match a clean checkout");
  }
  const key=process.env.PHASE2A_SERVICE_ROLE_KEY;
  if(!key) throw new Error("Explicit PHASE2A_SERVICE_ROLE_KEY required (no .env loading)");
  const db=createClient(target.supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const rpc:BackfillRpc=async(name,params)=>{const r=await db.rpc(name,params);return {data:r.data,error:r.error};};
  const call=async(name:string,params:Record<string,unknown>)=>{
    const r=await rpc(name,params); if(r.error) throw new Error(`Operator RPC failed (${r.error.code??"transport"}); inspect persisted state before retry`);return r.data;
  };
  const plan=await call("get_shopify_backfill_plan_v1",{requested_shop:target.shop,requested_operation:operation??null});
  if(["plan","preflight","inspect"].includes(command)) {
    console.log(JSON.stringify(redacted({target,plan,gateVerification:"Operator attestation only; deployed gate requires independent read-only verification",executableDatabaseValidation:"NOT RUN — isolated database target unavailable"}),null,2));return 0;
  }
  if(command==="preview") { console.log(JSON.stringify(await call("preview_shopify_backfill_v1",{requested_operation:operation}),null,2));return 0; }
  if(command==="start") {
    // An uncertain start is recovered by inspecting this exact operation UUID.
    const existing=record(plan).operation;
    assertReady(plan,target,existing?operation:undefined,existing?String(record(existing).run_id):undefined);
    console.log(JSON.stringify(redacted(await call("start_shopify_backfill_v1",{requested_operation:operation,requested_identity:target,confirmation:flags.confirm})),null,2));return 0;
  }
  assertReady(plan,target,operation,flags.run);
  if(command==="complete") {
    console.log(JSON.stringify(redacted(await call("complete_shopify_backfill_v1",{requested_operation:operation,requested_run_id:flags.run,approved_preview:preview,confirmation:flags.confirm})),null,2));return 0;
  }
  const maxPages=Number(flags["max-pages"]??"1");
  if(!Number.isInteger(maxPages) || maxPages<1 || maxPages>20) throw new Error("max-pages must be 1..20");
  const run=record(record(plan).run);
  if(run.hasNextPage===false) { console.log(JSON.stringify({status:run.status==="completed"?"completed":"completion_hold",runId:flags.run}));return 0; }
  const connection=await db.from("shopify_connections").select("access_token,inventory_location_id").eq("shop",target.shop).single();
  if(connection.error || !connection.data?.access_token || connection.data.inventory_location_id!==target.locationId) throw new Error("Bound source connection unavailable");
  const result=await runProtectedBackfill({target,operation:operation!,run:flags.run,confirmation:flags.confirm,rpc,accessToken:connection.data.access_token,maxPages});
  console.log(JSON.stringify(redacted(result),null,2));return 0;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(code=>{process.exitCode=code;}).catch(()=>{
    // Transport/provider errors may contain credentials. Deliberately don't echo them.
    console.error("Operator command rejected or outcome unresolved. Check explicit inputs and inspect the bound operation before retry. No automatic recovery mutation was attempted.");process.exitCode=1;
  });
}
