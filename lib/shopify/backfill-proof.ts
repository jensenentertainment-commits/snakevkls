import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { parseRoyCatalogFoundation } from "../intelligence/roy/catalog-foundation-contract.ts";
import { parseRoyTargetedContent } from "../intelligence/roy/targeted-content-contract.ts";
import { record, parseBackfillTarget, assertUuid } from "./backfill-operation.ts";

export type ProofCheck = { code: string; status: "PASS" | "FAIL" | "BLOCKED"; detail: string };
export type BackfillProof = {
  schemaVersion: 1; inputDigest: string; status: ProofCheck["status"]; checks: ProofCheck[];
  exactCounts: unknown; boundedTargetSampleCount: number;
  executableDatabaseValidation: "NOT RUN — isolated database target unavailable";
  activation: "BLOCKED — separate database validation, rollout and activation approval required";
};
// Canonical comparison of timestamp strings, retaining database microseconds.
function normalized(v: unknown): unknown {
  if (typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)$/.test(v))
    return v.replace(/(?:Z|\+00:00)$/, "Z").replace(/\.([0-9]*?)0+Z$/, (_, fraction: string) => fraction ? `.${fraction}Z` : "Z");
  if (Array.isArray(v)) return v.map(normalized);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k,value])=>[k,normalized(value)]));
  return v;
}
/** Offline proof only. Missing/malformed evidence cannot produce a passing report. */
export function proveBackfill(snapshot: unknown): BackfillProof {
  const serialized=JSON.stringify(snapshot);
  if (!serialized || Buffer.byteLength(serialized)>512*1024) throw new Error("Snapshot must be bounded to 512 KiB");
  const root=record(snapshot), facts=record(root.facts), provenance=record(facts.provenance);
  const checks: ProofCheck[]=[];
  const check=(code:string,ok:unknown,detail:string,blocked=false)=>checks.push({code,status:ok===true?"PASS":blocked?"BLOCKED":"FAIL",detail});
  check("snapshot",root.schemaVersion===1 && facts.schemaVersion===1 && root.snapshotIsolation==="repeatable read" && root.readOnly==="on"
    && typeof root.snapshot==="string" && typeof root.database==="string","Oracle and caller-RLS readers must share one read-only repeatable-read export.");
  let binding=false;
  try {
    const op=record(facts.operation),run=record(facts.run);
    parseBackfillTarget(op.identity);assertUuid(String(op.operation_id));assertUuid(String(op.run_id));
    binding=op.run_id===run.runId && typeof op.started_at==="string" && Number.isFinite(Date.parse(op.started_at));
  } catch { /* Missing provenance is a failure. */ }
  check("operation_binding",binding,"Explicit operation/run, code contract, target and gate attestation.");
  let aggregate: ReturnType<typeof parseRoyCatalogFoundation>|undefined;
  try { aggregate=parseRoyCatalogFoundation(root.aggregate); check("aggregate_contract",true,"Exact counts, bounded evidence, truncation and no technical-ID keys/text validated."); }
  catch { check("aggregate_contract",false,"Invalid aggregate response contract."); }
  for(const key of ["totals","contentCoverage","fields","collections","freshness"] as const)
    check(`aggregate_${key}`,!!aggregate && isDeepStrictEqual(normalized(aggregate[key]),normalized(facts[key])),"Compared with independently queried database facts.");
  const coverage=record(facts.contentCoverage), collections=record(facts.collections);
  const collectionDetail=record(facts.collectionDetail);
  const detailValid=Number.isSafeInteger(collectionDetail.noCanonicalRow) && (collectionDetail.noCanonicalRow as number)>=0
    && Number.isSafeInteger(collectionDetail.incompleteCanonicalRow) && (collectionDetail.incompleteCanonicalRow as number)>=0
    && (collectionDetail.noCanonicalRow as number)+(collectionDetail.incompleteCanonicalRow as number)===collections.unknownOrIncompleteProductCount;
  check("collection_populations",detailValid,"No canonical row and incomplete canonical row partition unknown/incomplete membership; neither means zero collections.");
  check("canonical_coverage",coverage.unknownProductCount===0 && collections.unknownOrIncompleteProductCount===0,"Unknown coverage remains a readiness blocker; it is never fabricated.",true);
  check("operation_complete",record(facts.run).status==="completed" && typeof record(facts.operation).completed_at==="string","Held or unresolved operations are not completed proof.",true);
  check("page_chain",Number.isSafeInteger(provenance.receiptPages) && (provenance.receiptPages as number)>0 && provenance.receiptPages===provenance.runPages && provenance.chainValid===true && provenance.finalPageCommitted===true,"Contiguous page/cursor chain and terminal persisted state.");
  check("source_evidence",provenance.sourceEvidenceValid===true && /^[a-f0-9]{64}$/.test(String(provenance.receiptDigest)),"Terminal collection evidence and normalized payload receipt digest.");
  for(const key of ["contentMismatches","collectionMismatches","variantMismatches"])
    check(key,provenance[key]===0,"Latest source receipt agrees with persisted data; disagreement requires investigation.");
  check("manifest_coverage",provenance.activeProductsWithoutReceipt===0,"Every active product must have source-derived operation evidence.",true);
  check("sync_counters",provenance.counterAgreement===true,"Per-variant processed/skipped/legacy relation counters agree with receipts.");
  check("physical_inventory",provenance.inventoryUnchanged===true,"A changed physical inventory digest needs independent attribution; live business writes may be legitimate.",true);
  check("reconciliation",provenance.reconciliationAgreement===true,"Approved affected count and unseen post-completion state agree.",provenance.reconciliationAgreement==null);
  const expected=facts.targets, actual=root.targets;
  let targetCount=0;
  const targetShape=Array.isArray(expected) && Array.isArray(actual) && expected.length===actual.length && expected.length<=8
    && facts.sampleLimit===8 && expected.length===Math.min(8, Number(facts.targetEligibleCount));
  check("target_allocation",targetShape,"Deterministic stratified samples, at most eight; exact counts remain separate.");
  if(targetShape && Array.isArray(expected) && Array.isArray(actual)) {
    targetCount=expected.length;
    for(let i=0;i<expected.length;i++) {
      let ok=false;
      try {
        const e=record(expected[i]), a=record(actual[i]), t=parseRoyTargetedContent(a.result);
        ok=e.sku===a.sku && t.status==="found" && t.selectedVariant?.sku===e.sku && t.variantCount===e.variantCount
          && t.canonicalCollections?.state===e.collectionState && t.canonicalCollections?.membershipCount===e.membershipCount
          && t.selectedVariant?.priceMinor===e.priceMinor && t.selectedVariant?.quantity===e.quantity && t.selectedVariant?.inventoryTracked===e.inventoryTracked
          && isDeepStrictEqual(Object.fromEntries(Object.entries(t.productContent!.fields).map(([k,v])=>[k,v.state])),e.fieldStates);
      } catch { /* Report a failed check; never coerce invalid data into unknown. */ }
      check(`target_${i+1}`,ok,"Selected variant facts, field states, complete membership count, response bounds and ID suppression.");
    }
  }
  check("target_coverage",targetCount>0 || record(facts.totals).productCount===0,"Nonempty catalogs require eligible targeted-reader samples.",true);
  return {schemaVersion:1,inputDigest:createHash("sha256").update(serialized).digest("hex"),status:checks.some(c=>c.status==="FAIL")?"FAIL":checks.some(c=>c.status==="BLOCKED")?"BLOCKED":"PASS",
    checks,exactCounts:aggregate?{totals:aggregate.totals,contentCoverage:aggregate.contentCoverage,fields:aggregate.fields,collections:aggregate.collections,
      collectionDetail:detailValid?{noCanonicalRow:collectionDetail.noCanonicalRow,incompleteCanonicalRow:collectionDetail.incompleteCanonicalRow}:null,freshness:aggregate.freshness}:null,boundedTargetSampleCount:targetCount,
    executableDatabaseValidation:"NOT RUN — isolated database target unavailable",activation:"BLOCKED — separate database validation, rollout and activation approval required"};
}
export function proofSummary(report: BackfillProof): string {
  return [`Phase 2A proof v1: ${report.status}`,`Snapshot digest: ${report.inputDigest}`,`Target samples: ${report.boundedTargetSampleCount} (bounded; not catalog totals)`,
    ...report.checks.map(c=>`${c.status} ${c.code}: ${c.detail}`),report.executableDatabaseValidation,report.activation].join("\n");
}
