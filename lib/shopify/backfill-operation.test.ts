import assert from "node:assert/strict";
import test from "node:test";
import { approval, assertReady, parseBackfillTarget, requireApproval, runProtectedBackfill, BACKFILL_VERSION, type BackfillRpc, type BackfillTarget } from "./backfill-operation.ts";
import { parseArgs, main } from "../../scripts/roy-phase2a/cli.ts";

const operation="98000000-0000-4000-8000-000000000001",run="98000000-0000-4000-8000-000000000002";
const target: BackfillTarget={projectRef:"abcdefghijklmnopqrst",supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co",shop:"fixture.myshopify.com",locationId:"gid://shopify/Location/5",codeRevision:"a".repeat(40),contractVersion:BACKFILL_VERSION,runtimeGateDisabled:true as const};
test("target and approval fail closed for unexpected identity, gate, fields or command",()=>{
  assert.deepEqual(parseBackfillTarget(target),target);
  for(const patch of [{supabaseUrl:"https://other.supabase.co"},{runtimeGateDisabled:false},{locationId:"5"},{codeRevision:"master"},{extra:true},{shop:"fixture.myshopify.com.evil.test"}])
    assert.throws(()=>parseBackfillTarget({...target,...patch}));
  for(const command of ["start","resume","complete"] as const) {
    const phrase=approval(command,target,operation,run,"a".repeat(64));
    assert.doesNotThrow(()=>requireApproval(phrase,phrase));
    for(const wrong of [undefined,"yes",phrase.toLowerCase(),phrase+" "]) assert.throws(()=>requireApproval(wrong,phrase));
  }
});
test("CLI default is read-only and mutation flags cannot leak into other commands",async()=>{
  assert.deepEqual(parseArgs([]),{command:"plan",flags:{}});
  assert.equal(await main([]),0);
  for(const args of [["proof","--confirm","yes"],["start","--confirm"],["plan","--target","a","--target","b"],["deploy"],["resume","--force","true"]]) assert.throws(()=>parseArgs(args));
});
test("preflight blocks old runs, wrong binding and missing artifacts",()=>{
  const plan={schemaVersion:1,controlVersion:BACKFILL_VERSION,writerVersion:"apply_shopify_sync_page_v2",shop:target.shop,locationId:target.locationId,connectionAvailable:true,proofAvailable:true,resumableRun:null,
    functions:Object.fromEntries(["get_roy_catalog_foundation_v1","get_roy_targeted_product_v1","apply_shopify_sync_page_v2","start_shopify_backfill_v1"].map(k=>[k,"a".repeat(32)]))};
  assert.doesNotThrow(()=>assertReady(plan,target));
  assert.throws(()=>assertReady({...plan,resumableRun:{pagesProcessed:12}},target));
  assert.throws(()=>assertReady({...plan,proofAvailable:false},target));
  const bound={...plan,operation:{operation_id:operation,run_id:run,identity:target}};
  assert.doesNotThrow(()=>assertReady(bound,target,operation,run));
  assert.throws(()=>assertReady(bound,target,operation,operation));
});
function scenario(loseAck=false) {
  const events:string[]=[];
  let pages=0;
  const state=()=>({runId:run,status:"running",pagesProcessed:pages,cursor:pages?"final":null,hasNextPage:pages===0,processedCount:pages*2,skippedNoSku:0,collectionsLinked:0,reconciledCount:0,leaseExpiresAt:new Date(Date.now()+90_000).toISOString()});
  const rpc:BackfillRpc=async(name,args)=>{
    events.push(name);
    if(name==="claim_shopify_backfill_v1") return {data:{...state(),acquired:pages===0,leaseToken:"lease"},error:null};
    if(name==="apply_shopify_backfill_page_v1") {
      assert.equal(args.expected_pages_processed,0);
      assert.equal((args.page_products as unknown[]).length,1);
      assert.equal((args.page_variants as unknown[]).length,2);
      const evidence=(args.traversal_evidence as Record<string,unknown>[])[0];
      assert.equal(evidence.pageCount,1);assert.equal(evidence.finalHasNextPage,false);assert.equal(evidence.membershipCount,0);
      assert.match(String(evidence.cursorDigest),/^[a-f0-9]{64}$/);
      pages++;
      return {data:loseAck?null:state(),error:loseAck?{message:"lost response"}:null};
    }
    if(name==="recover_shopify_backfill_v1") return {data:state(),error:null};
    if(name==="pause_shopify_backfill_v1") return {data:{...state(),status:"paused"},error:null};
    throw new Error("Unexpected RPC "+name);
  };
  const fetcher:typeof fetch=async()=>{
    events.push("source");
    const product={id:"gid://shopify/Product/1",title:"Fresh",description:"",seo:{title:null,description:null},handle:"fresh",category:null,productType:"",vendor:"",status:"ACTIVE",updatedAt:"2026-09-19T01:00:00Z",featuredImage:null,collections:{edges:[],pageInfo:{hasNextPage:false,endCursor:null}}};
    return new Response(JSON.stringify({data:{shop:{currencyCode:"NOK"},location:{id:target.locationId,name:"Fixture",isActive:true},productVariants:{edges:[1,2].map(id=>({node:{id:`gid://shopify/ProductVariant/${id}`,sku:`SKU-${id}`,title:"Default Title",price:"12.34",inventoryItem:{id:`gid://shopify/InventoryItem/${id}`,tracked:true,inventoryLevel:null},product}})),pageInfo:{hasNextPage:false,endCursor:"final"}}}}));
  };
  const invoke=()=>runProtectedBackfill({target,operation,run,confirmation:approval("resume",target,operation,run),rpc,accessToken:"fixture-not-real",maxPages:1,fetch:fetcher});
  return {events,invoke};
}
test("protected source reuses mapping, deduplicates products, records terminal evidence and pauses before completion",async()=>{
  const s=scenario();assert.equal((await s.invoke()).status,"completion_hold");
  assert.deepEqual(s.events,["claim_shopify_backfill_v1","source","apply_shopify_backfill_page_v1","pause_shopify_backfill_v1"]);
  assert.equal((await s.invoke()).status,"completion_hold");
  assert.equal(s.events.filter(e=>e==="source").length,1);
});
test("lost protected page acknowledgement resolves from bound persisted state, then stays held",async()=>{
  const s=scenario(true);await assert.rejects(s.invoke(),/requires reclaim/);
  assert.equal(s.events.at(-1),"recover_shopify_backfill_v1");
  assert.equal((await s.invoke()).status,"completion_hold");
  assert.equal(s.events.filter(e=>e==="apply_shopify_backfill_page_v1").length,1);
});
