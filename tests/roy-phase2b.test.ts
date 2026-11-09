import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseReview, reviewIntroduction, REVIEW_RULES, reviewError } from '../lib/intelligence/roy/review.ts';
const summary={products:785,variants:1408,dataGaps:0,recommendations:0,information:800,uncertain:0,new:800,resolved:0,reopened:0,sourceOldest:null,sourceNewest:null};
test('recommendations use singular only for one finding',()=>{
  assert.match(reviewIntroduction({...summary,recommendations:1}),/1 anbefaling om/);
  assert.match(reviewIntroduction({...summary,recommendations:2}),/2 anbefalinger om/);
});
test('optional fields do not dominate the work summary',()=>{
  const text=reviewIntroduction(summary);
  assert.match(text,/ingen manglende beskrivelser/);assert.doesNotMatch(text,/800|feil/);
  assert.match(REVIEW_RULES.sku_missing[2],/valgfri/);
  assert.match(REVIEW_RULES.seo_title_default[2],/standardtittel/);
});
test('incomplete evidence is explicitly qualified',()=>assert.match(reviewIntroduction({...summary,dataGaps:1,uncertain:2}),/ikke erklært løst/));
test('report contract rejects invalid counts and rules',()=>{
  assert.deepEqual(parseReview({run:null,findings:[],total:0}),{run:null,findings:[],total:0});
  assert.throws(()=>parseReview({run:null,findings:[],total:1}));
  assert.throws(()=>parseReview({run:{id:'x',shop:'x',completed_at:new Date().toISOString(),rule_version:1,summary:{...summary,products:-1}},findings:[],total:0}));
  assert.throws(()=>parseReview({run:null,findings:[{rule:'made_up'}],total:1}));
});
test('conflict messages preserve previous report',()=>{
  assert.match(reviewError('55P03'),/Ingen ny rapport/);assert.match(reviewError('55000'),/beholdt/);
});
test('API retains cookie authentication, admin execution and default-off gate',()=>{
  const api=readFileSync('app/api/roy/review/route.ts','utf8');
  assert.match(api,/requireRole\(\['admin'\]\)/);assert.match(api,/headers.get\('origin'\)/);
  assert.doesNotMatch(api,/service.role|createAdmin|shopify\/sync/i);
  assert.match(readFileSync('lib/intelligence/roy/phase2b-gate.ts','utf8'),/=== 'true'/);
});
test('page only reads on opening and information remains behind disclosure',()=>{
  const page=readFileSync('app/shopify/page.tsx','utf8');
  assert.doesNotMatch(page,/run_roy_review/);
  const ui=readFileSync('app/shopify/RoyWorkReport.tsx','utf8');
  assert.match(ui,/priority<=2/);assert.match(ui,/slice\(0,3\)/);assert.match(ui,/aria-expanded/);
  assert.match(ui,/requestId.current \?\?=/);
});

test('conversation-first layout keeps quick questions unsent and report bounded',()=>{
  const chat=readFileSync('app/shopify/RoyCatalogWorkspace.tsx','utf8');
  assert.match(chat,/onClick=\{\(\)=>setQuestion\(prompt\)\}/);
  assert.doesNotMatch(chat,/analyze\(prompt\)/);
  assert.match(chat,/role="log"/);
  assert.match(chat,/rows=\{2\}/);
  const report=readFileSync('app/shopify/RoyWorkReport.tsx','utf8');
  assert.ok(report.indexOf('{children}')<report.indexOf('<section aria-labelledby="roy-report-title"'));
  assert.match(report,/3fr\)_minmax\(0,2fr/);
  assert.match(report,/slice\(0,3\)/);
  assert.match(report,/canRun\?<div/);
});
