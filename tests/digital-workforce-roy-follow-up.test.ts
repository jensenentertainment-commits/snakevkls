import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {resolvePhase2aRoute} from '../lib/intelligence/roy/phase2a-context.ts';
import {wantsRoyDetails} from '../lib/intelligence/roy/phase2a-concise.ts';
import {displayProductName,quoteRoyProductName} from '../lib/intelligence/roy/display-text.ts';
import {validateChatInput} from '../lib/intelligence/shared/chat-input.ts';
const followups=['Kan du forklare datagrunnlaget bak dette?','Hvor kommer disse tallene fra?','Når ble dette sist oppdatert?','Kan du utdype?'];
function route(question:string,history:{role:'user'|'assistant';text:string}[]=[]){
 const input=validateChatInput({question,history,page:'/shopify'});assert.equal(input.ok,true);
 return resolvePhase2aRoute(input.value);
}
test('real request history contract resolves catalog, SKU and exact variant follow-ups',()=>{
 for(const anchor of ['Hvilke produkter mangler SEO?','Hvilke produkter mangler bilder?','Hvor mange produkter har vi i katalogen?','Har SKU ABC-123 bilde?','Vis produktinnhold for Variant-ID 123']){
  const history:{role:'user'|'assistant';text:string}[]=[{role:'user',text:anchor},{role:'assistant',text:'Et svar med et annet eksempel SKU OTHER-456.'}];
  for(const question of followups){
   assert.deepEqual(route(question,history),route(anchor));assert.equal(wantsRoyDetails(question),true);
   history.push({role:'user',text:question},{role:'assistant',text:'Dokumentasjon'});
   if(history.length>8) history.splice(0,history.length-8);
  }
 }
});
test('unclear history and assistant examples cannot guess product identity',()=>{
 for(const question of followups){
  assert.deepEqual(route(question),{kind:'clarify'});
  assert.deepEqual(route(question,[{role:'assistant',text:'SKU ABC-123'}]),{kind:'clarify'});
  for(const barrier of ['Sammenlign SKU ABC-123 og SKU XYZ-456','Vis Variant-ID ugyldig','Hva med frakt?']){
   assert.deepEqual(route(question,[{role:'user',text:'Har SKU OLD-123 bilde?'},{role:'user',text:barrier}]),{kind:'clarify'});
  }
 }
 assert.deepEqual(route('Kan du utdype Variant-ID 456?',[{role:'user',text:'Har SKU ABC-123 bilde?'}]),{kind:'variant',variantId:'gid://shopify/ProductVariant/456'});
 assert.deepEqual(route('Kan du utdype?',[{role:'user',text:'Har SKU OLD-123 bilde?'},{role:'user',text:'Hvilke produkter mangler bilder?'}]),{kind:'foundation',field:'imageReference'});
});
test('production UI sends bounded user history through validated server input',()=>{
 const ui=readFileSync('app/shopify/RoyCatalogWorkspace.tsx','utf8');
 const api=readFileSync('app/api/roy/ask/route.ts','utf8');
 const provider=readFileSync('lib/intelligence/workforce/contexts/shopify-catalog-provider.ts','utf8');
 assert.match(ui,/sessionStorage.getItem/);assert.match(ui,/history: requestHistory/);
 assert.match(ui,/slice\(-CHAT_LIMITS.historyMessages\)/);
 assert.match(api,/validateChatInput\(body\)/);assert.match(api,/request: input.value/);
 assert.match(provider,/resolvePhase2aRoute\(input\)/);
 assert.match(ui,/>\{text\}<\/p>/);assert.doesNotMatch(ui,/dangerouslySetInnerHTML/);
});
test('product names decode one layer and remain safely escaped by React',()=>{
 assert.equal(displayProductName('Røde Bær &amp; Dekorasjon'),'Røde Bær & Dekorasjon');
 assert.equal(displayProductName('A &#38; B &#x26; C &quot;D&quot;'),'A & B & C "D"');
 assert.equal(displayProductName('&amp;lt;script&amp;gt;'),'&lt;script&gt;');
 assert.equal(displayProductName('A & B'),'A & B');
 const text=quoteRoyProductName('&lt;img src=x onerror=alert(1)&gt;');
 const html=renderToStaticMarkup(createElement('p',null,text));
 assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
 assert.equal(renderToStaticMarkup(createElement('p',null,quoteRoyProductName('A &amp; B'))),'<p>«A &amp; B»</p>');
});
