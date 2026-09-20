import assert from "node:assert/strict";
import test from "node:test";
import { proveBackfill,proofSummary } from "./backfill-proof.ts";
import { BACKFILL_VERSION } from "./backfill-operation.ts";
import { ROY_CATALOG_FOUNDATION_FIELDS as fields,ROY_CATALOG_FOUNDATION_FINDINGS as findings,ROY_CATALOG_FOUNDATION_FRESHNESS as freshness,ROY_CATALOG_FOUNDATION_LIMITATIONS as limitations,ROY_CATALOG_FOUNDATION_LIMITS as limits } from "../intelligence/roy/catalog-foundation-contract.ts";
import { TARGET_FIELDS,TARGET_LIMITS,TARGET_LIMITATIONS } from "../intelligence/roy/targeted-content-contract.ts";

function fixture(n=1) {
  const time="2026-09-19T10:00:00Z";
  const aggregate={schemaVersion:1,scope:"active_shopify_products",scopeAuthority:"snake_products_active_shopify_linked",generatedAt:time,
    totals:{productCount:n,variantCount:n},contentCoverage:{observedProductCount:n,unknownProductCount:0},fields:Object.fromEntries(fields.map(f=>[f,{unknownCount:0,missingCount:n,presentCount:0}])),
    collections:{unknownOrIncompleteProductCount:0,completeProductCount:n,completeWithZeroCollectionsCount:n,completeWithCollectionsCount:0},
    freshness:Object.fromEntries(freshness.map(f=>[f,{populationUnit:f==="variantSyncedAt"?"variant":"product",populationCount:n,timestampCount:n,oldest:n?time:null,newest:n?time:null}])),
    findings:n?findings.filter(f=>!["content_unknown","collections_unknown_or_incomplete"].includes(f)).map(code=>({code,scope:"product",affectedProductCount:n,examples:[],examplesTruncated:true})):[],
    evidence:{returnedExampleCount:0,truncated:n>0,budgetLimited:false},limits,limitations};
  const states=Object.fromEntries(TARGET_FIELDS.map(f=>[f,"missing"]));
  const expected={sku:"FIXTURE",fieldStates:states,variantCount:1,collectionState:"complete",membershipCount:0,priceMinor:1234,quantity:2,inventoryTracked:true};
  const target={schemaVersion:1,source:"roy_targeted_product_v1",scopeAuthority:"snake_products_active_shopify_linked",status:"found",generatedAt:time,
    selectedVariant:{sku:"FIXTURE",productName:"Fixture",variantName:null,priceMinor:1234,currency:"NOK",quantity:2,inventoryTracked:true,inventoryObservedAt:time,syncedAt:time,textTruncated:false},
    siblingVariants:[],variantCount:1,siblingsTruncated:false,productContent:{fields:Object.fromEntries(TARGET_FIELDS.map(f=>[f,{state:"missing",value:null,truncated:false,withheld:false}])),contentObservedAt:time,shopifyUpdatedAt:time,persistedAt:time},
    canonicalCollections:{state:"complete",observedAt:time,membershipCount:0,names:[],displayTruncated:false},budgetLimited:false,limits:TARGET_LIMITS,limitations:TARGET_LIMITATIONS};
  const facts={...structuredClone(aggregate),operation:{operation_id:"98000000-0000-4000-8000-000000000001",run_id:"98000000-0000-4000-8000-000000000002",started_at:time,completed_at:time,
    identity:{projectRef:"abcdefghijklmnopqrst",supabaseUrl:"https://abcdefghijklmnopqrst.supabase.co",shop:"fixture.myshopify.com",locationId:"gid://shopify/Location/1",codeRevision:"a".repeat(40),contractVersion:BACKFILL_VERSION,runtimeGateDisabled:true}},
    run:{runId:"98000000-0000-4000-8000-000000000002",status:"completed"},provenance:{receiptPages:1,runPages:1,chainValid:true,finalPageCommitted:true,sourceEvidenceValid:true,receiptDigest:"a".repeat(64),contentMismatches:0,collectionMismatches:0,variantMismatches:0,activeProductsWithoutReceipt:0,counterAgreement:true,inventoryUnchanged:true,reconciliationAgreement:true},
    targets:n?[expected]:[],sampleLimit:8,targetEligibleCount:n,collectionDetail:{noCanonicalRow:0,incompleteCanonicalRow:0}};
  return {schemaVersion:1,snapshotIsolation:"repeatable read",readOnly:"on",snapshot:"1:2:",database:"snake_phase2a_test",facts,aggregate,targets:n?[{sku:"FIXTURE",result:target}]:[]};
}
test("proof is deterministic, exact counts are separate, and activation remains explicitly blocked",()=>{
  const input=fixture();const p=proveBackfill(input);
  assert.equal(p.status,"PASS");assert.deepEqual(p,proveBackfill(input));assert.equal(p.boundedTargetSampleCount,1);
  assert.match(proofSummary(p),/NOT RUN — isolated database target unavailable/);
  assert.match(p.activation,/BLOCKED/);
  assert.equal(proveBackfill(fixture(0)).status,"PASS");
});
for(const key of ["contentMismatches","collectionMismatches","variantMismatches"] as const)
  test(`proof rejects ${key} rather than hiding legitimate source/persistence disagreement`,()=>{const f=fixture();f.facts.provenance[key]=1;assert.equal(proveBackfill(f).status,"FAIL");});
test("missing or partial evidence cannot produce PASS",()=>{
  for(const key of ["chainValid","finalPageCommitted","sourceEvidenceValid","counterAgreement","reconciliationAgreement"] as const) {
    const f=fixture();f.facts.provenance[key]=false;assert.equal(proveBackfill(f).status,"FAIL");
  }
  const f=fixture();f.facts.provenance.activeProductsWithoutReceipt=1;assert.equal(proveBackfill(f).status,"BLOCKED");
  f.facts.provenance.inventoryUnchanged=false;assert.equal(proveBackfill(f).checks.find(c=>c.code==="physical_inventory")?.status,"BLOCKED");
});
test("oracle disagreements and non-snapshot export fail",()=>{
  const f=fixture();f.facts.fields.description.missingCount=0;assert.equal(proveBackfill(f).status,"FAIL");
  const g=fixture();g.snapshotIsolation="read committed";assert.equal(proveBackfill(g).status,"FAIL");
  g.facts.freshness.contentObservedAt.newest="2026-09-19T10:00:00.000001Z";assert.equal(proveBackfill(g).status,"FAIL");
});
test("target state, selected variant facts, IDs, bounds and missing sample are independently checked",()=>{
  const f=fixture();f.targets[0].result.selectedVariant.quantity=99;assert.equal(proveBackfill(f).status,"FAIL");
  const g=fixture();g.targets[0].result.selectedVariant.productName="gid://shopify/Product/1";const report=proveBackfill(g);assert.equal(report.status,"FAIL");assert.doesNotMatch(JSON.stringify(report),/gid:\/\/shopify/);
  const h=fixture();h.targets=[];assert.equal(proveBackfill(h).status,"FAIL");
  const i=fixture();i.targets[0].result.limits={...TARGET_LIMITS,maxSiblings:25} as unknown as typeof TARGET_LIMITS;assert.equal(proveBackfill(i).status,"FAIL");
});
test("malformed/unbounded snapshots reject without report data leakage",()=>{
  assert.throws(()=>proveBackfill({}));assert.throws(()=>proveBackfill("x".repeat(512*1024)));
});
