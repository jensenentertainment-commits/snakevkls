import {spawn} from 'node:child_process';
// Caller has already verified identity and empty synthetic populations.
export async function concurrency(config,sql,file,evidence,persist,duplicateCompletion=false) {
 const sessions=[];
 function session(name){
   const p=spawn(config.psql,['-X','-w','-qAt','-v','ON_ERROR_STOP=1'],{env:{...config.childEnv,PGAPPNAME:name},windowsHide:true,stdio:['pipe','pipe','pipe']});
   let out='',err='',closed=false;
   p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',()=>closed=true);
   p.on('error',e=>{err+=e.message;closed=true;});
   const s={p,name,send:q=>p.stdin.write(q+'\n'),wait:async token=>{
     const until=Date.now()+15000;
     while(!out.includes(token)){if(closed||err.includes('ERROR:'))throw new Error(name+' failed: '+err);if(Date.now()>until)throw new Error(name+' barrier timeout');await new Promise(r=>setTimeout(r,50));}
   },log:()=>({name,stdout:out,stderr:err})};sessions.push(s);return s;
 }
 try {
   file('tests/database/viper-v2.seed.sql',true);
   const j=JSON.parse(sql('concurrency-ids',"select json_build_object('job',j.id,'line',l.id,'order',j.order_id) from public.pick_jobs j join public.pick_lines l on l.pick_job_id=j.id"));
   const actor='81000000-0000-4000-8000-000000000001';
   const proof="(select jsonb_build_object('externalOrderId',o.external_order_id,'externalUpdatedAt',o.external_updated_at,'observedAt',clock_timestamp(),'lines',(select jsonb_agg(jsonb_build_object('externalLineId',external_line_id,'shopifyVariantId',shopify_variant_id,'sku',sku,'requestedQuantity',requested_quantity)) from public.order_lines where order_id=o.id)) from public.orders o where o.id='"+j.order+"')";
   const call=(action,payload,version)=>"public.apply_viper_pick_command('"+j.job+"',"+version+",gen_random_uuid(),'"+action+"','"+JSON.stringify(payload)+"','"+actor+"',"+proof+")";
   const c=session('viper_step3_C'),d=session('viper_step3_D');
   c.send("\\i tests/database/viper-acceptance.guard.sql");d.send("\\i tests/database/viper-acceptance.guard.sql");
   for(const [n,update,restore,expected] of [
     [0,"update public.inventory set quantity=1 where id='85000000-0000-4000-8000-000000000001'","update public.inventory set quantity=6 where id='85000000-0000-4000-8000-000000000001'",'VIPER_STOCK_CHANGED'],
     [1,"update public.locations set active=false where code='VT-PICK'","update public.locations set active=true where code='VT-PICK'",'VIPER_LOCATION_CHANGED'],
     [2,"update public.order_lines set requested_quantity=requested_quantity+1","update public.order_lines set requested_quantity=requested_quantity-1",'VIPER_SOURCE_CHANGED'],
   ]) {
     c.send("begin; "+update+"; select 'CHANGED_"+n+"';");await c.wait('CHANGED_'+n);
     d.send("do $$ begin begin perform "+call('start',{},0)+"; raise exception 'TEST expected changed physical state'; exception when sqlstate 'P0001' then assert sqlerrm='"+expected+"',sqlerrm; end; end $$; select 'REJECTED_"+n+"';");
     let blocked=false;for(let k=0;k<30&&!blocked;k++){blocked=sql('wait-physical-'+n+'-'+k,"select exists(select 1 from pg_stat_activity d join pg_stat_activity c on c.pid=any(pg_blocking_pids(d.pid)) where d.application_name='viper_step3_D' and c.application_name='viper_step3_C')")==='t';if(!blocked)await new Promise(r=>setTimeout(r,100));}
     if(!blocked)throw new Error('Physical writer did not block validation');
     c.send("commit; select 'COMMITTED_"+n+"';");await c.wait('COMMITTED_'+n);await d.wait('REJECTED_'+n);
     sql('no-start-after-race-'+n,"do $$ begin assert (select status from public.pick_jobs)='ready'; assert (select version from public.pick_jobs)=0; assert not exists(select 1 from public.stock_movements); end $$;");
     sql('restore-synthetic-'+n,restore);
   }
   sql('concurrency-start','select '+call('start',{},0));
   const ex=JSON.parse(sql('concurrency-report','select '+call('report',{lineId:j.line,exceptionType:'damaged'},1))).exceptionId;
   const a=session('viper_step3_A'),b=session('viper_step3_B');
   a.send("\\i tests/database/viper-acceptance.guard.sql");
   b.send("\\i tests/database/viper-acceptance.guard.sql");
   for(const [index,action,payload] of [[0,'report',{lineId:j.line,exceptionType:'damaged'}],[1,'resolve',{exceptionId:ex,resolutionNote:'Checked'}]]) {
     const v=Number(sql('version-'+index,"select version from public.pick_jobs where id='"+j.job+"'"));
     a.send("begin; select 1 from public.pick_jobs where id='"+j.job+"' for update; select 'A_LOCKED_"+index+"';");
     await a.wait('A_LOCKED_'+index);
     b.send("do $$ begin begin perform "+call(action,payload,v)+"; raise exception 'TEST expected stale'; exception when sqlstate 'P0001' then assert sqlerrm='VIPER_STALE_VERSION',sqlerrm; end; end $$; select 'B_DONE_"+index+"';");
     let blocked=false;
     for(let n=0;n<30&&!blocked;n++){
       blocked=sql('wait-job-'+index+'-'+n,"select exists(select 1 from pg_stat_activity b join pg_stat_activity a on a.pid=any(pg_blocking_pids(b.pid)) where b.application_name='viper_step3_B' and a.application_name='viper_step3_A')")==='t';
       if(!blocked)await new Promise(r=>setTimeout(r,100));
     }
     if(!blocked)throw new Error('Did not observe session B blocked by job lock');
     // If B took a line/exception lock first, these deterministic NOWAIT probes fail.
     a.send("select 1 from public.orders where id='"+j.order+"' for update nowait; select 1 from public.pick_lines where id='"+j.line+"' for update nowait; select 1 from public.pick_exceptions where id='"+ex+"' for update nowait; select "+call(index===0?'resolve':'report',index===0?{exceptionId:ex,resolutionNote:'Checked'}:{lineId:j.line,exceptionType:'damaged'},v)+"; commit; select 'A_DONE_"+index+"';");
     await a.wait('A_DONE_'+index);await b.wait('B_DONE_'+index);
   }
   // Concurrent completion and cancellation are serialized by the same job fence.
   sql('resolve-before-complete',"select "+call('resolve',{exceptionId:JSON.parse(sql('open-exception',"select json_build_object('id',id) from public.pick_exceptions where status='open'")).id,resolutionNote:'Checked'},Number(sql('current-version','select version from public.pick_jobs'))));
   sql('confirm-before-complete','select '+call('confirm',{lineId:j.line},Number(sql('current-version','select version from public.pick_jobs'))));
   const v=Number(sql('current-version','select version from public.pick_jobs'));
   a.send("begin; select 1 from public.pick_jobs where id='"+j.job+"' for update; select 'COMPLETE_LOCKED';");await a.wait('COMPLETE_LOCKED');
   b.send(duplicateCompletion
     ? "do $$ declare r jsonb; begin r:="+call('complete',{},v)+"; assert (r->>'idempotent')::boolean; assert r->>'status'='completed'; end $$; select 'CANCEL_DONE';"
     : "do $$ begin begin perform "+call('cancel',{reason:'Returned',physicalReturnConfirmed:true},v)+"; raise exception 'TEST expected stale'; exception when sqlstate 'P0001' then assert sqlerrm='VIPER_STALE_VERSION',sqlerrm; end; end $$; select 'CANCEL_DONE';");
   let blocked=false;for(let n=0;n<30&&!blocked;n++){blocked=sql('wait-complete-'+n,"select exists(select 1 from pg_stat_activity b join pg_stat_activity a on a.pid=any(pg_blocking_pids(b.pid)) where b.application_name='viper_step3_B' and a.application_name='viper_step3_A')")==='t';if(!blocked)await new Promise(r=>setTimeout(r,100));}
   if(!blocked)throw new Error('Cancellation did not wait for job');
   a.send('select '+call('complete',{},v)+"; commit; select 'COMPLETE_DONE';");await a.wait('COMPLETE_DONE');await b.wait('CANCEL_DONE');
   sql('completion-single-deduction',"do $$ begin assert (select count(*) from public.stock_movements)=1; assert (select quantity from public.inventory where id='85000000-0000-4000-8000-000000000001')=1; assert (select status from public.pick_jobs)='completed'; end $$;");
   for(const s of sessions){s.send('\\q');}
   // Exact synthetic teardown in a single transaction; all foreign-key children first.
   file('tests/database/viper-v2.cleanup.sql',true);
 } finally {
   for(const s of sessions){evidence.results.push(s.log());s.p.stdin.end();if(s.p.exitCode===null)s.p.kill();}
   persist();
 }
}
