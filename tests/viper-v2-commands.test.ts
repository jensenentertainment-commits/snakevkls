import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePickCommand} from '../lib/viper/picks/command-validation.ts';
const source=(p:string)=>readFileSync(p,'utf8');
test('command envelope rejects missing, stale-format and unsafe versions',()=>{
 const good={commandId:'81000000-0000-4000-8000-000000000001',expectedVersion:0,payload:{}};
 assert.deepEqual(parsePickCommand(good),good);
 for(const value of [null,{}, {...good,commandId:'x'}, {...good,expectedVersion:-1},{...good,expectedVersion:1.2},{...good,expectedVersion:2147483647},{...good,payload:null},{...good,payload:[]}]) assert.equal(parsePickCommand(value),null);
});
test('all row locks precede helpers and version fence precedes domain writes',()=>{
 const sql=source('supabase/migrations/20261104062000_viper_fenced_pick_commands.sql');
 const job=sql.indexOf('select * into job'),order=sql.indexOf('perform 1 from public.orders'),line=sql.indexOf('perform 1 from public.pick_lines'),ex=sql.indexOf('perform 1 from public.pick_exceptions');
 assert.ok(job<order && order<line && line<ex && ex<sql.indexOf('case requested_action'));
 assert.ok(sql.indexOf('VIPER_STALE_VERSION')<order);
 assert.match(sql,/previous.request <> fingerprint/);
 assert.match(sql,/security invoker set search_path = ''/);
 assert.match(sql,/enable row level security/);
 assert.doesNotMatch(sql,/update public.inventory/);
 assert.match(sql,/result:=private.complete_viper_pick/);
 for(const name of ['start_viper_pick','confirm_viper_pick_line','report_viper_pick_exception','resolve_viper_pick_exception','complete_viper_pick']) assert.ok(sql.includes('alter function public.'+name));
});
test('correction UI requires explanation and physical return and server owns actor identity',()=>{
 const ui=source('app/components/viper/PickCorrection.tsx');
 assert.match(ui,/!reason.trim()||!returned/);
 assert.match(ui,/physicalReturnConfirmed:returned/);
 const handler=source('lib/viper/picks/command-handler.ts');
 assert.match(handler,/requested_actor_id:actor.id/);
 assert.match(handler,/requested_expected_version:command.expectedVersion/);
 assert.match(source('app/components/viper/useViperCommand.ts'),/last.current.id/);
});
test('concurrency regression observes blocking and probes child locks without deadlock timing',()=>{
 const script=source('scripts/viper/step2-concurrency.mjs');
 assert.match(script,/pg_blocking_pids/);assert.match(script,/for update nowait/);
 assert.match(script,/VIPER_STALE_VERSION/);assert.match(script,/completion-single-deduction/);
});
