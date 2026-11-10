import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=(p:string)=>readFileSync(p,'utf8');
test('Arne legacy implementation remains byte-equivalent apart from wrapper function name',()=>{
 const prior=execFileSync('git',['show','01154cc74171e348f0577728abb962b31032891a:app/components/AskBorre.tsx'],{encoding:'utf8'}).replaceAll('\r\n','\n');
 const now=read('app/components/AskBorre.tsx').replaceAll('\r\n','\n');
 assert.equal(now.slice(now.indexOf('function LegacyAskBorre(')),prior.slice(prior.indexOf('export default function AskBorre(')).replace('export default function AskBorre(','function LegacyAskBorre('));
 assert.match(now,/props.variant \?\? "borre"/);
});
test('floating Borre preserves route context, keyboard dismissal and compact shared conversation',()=>{
 const source=read('app/components/BorreFloatingChat.tsx');
 assert.match(source,/<BorreWorkspace compact page=\{pathname\}/);
 assert.match(source,/event.key === "Escape"/);
 assert.match(source,/trigger.current\?\.focus/);
 assert.match(source,/75dvh/);
 assert.doesNotMatch(source,/fetch\(|supabase|warehouse.*summary/);
 const chat=read('app/borre/BorreWorkspace.tsx');
 assert.match(chat,/Hei! Hva trenger du hjelp med\?/);
 assert.match(chat,/onClick=\{\(\) => \{ setQuestion\(prompt\)/);
 assert.match(chat,/loading=\{busy\}/);
 assert.match(chat,/motion-reduce:animate-none/);
 assert.match(chat,/page, history:/);
});
