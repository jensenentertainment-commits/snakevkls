\set ON_ERROR_STOP on
\ir viper-acceptance.guard.sql
-- Owned transaction for regression runs; migrations are applied separately.
begin;
\ir viper-v2.seed.sql
create function pg_temp.command(action text, payload jsonb default '{}', actor uuid default '81000000-0000-4000-8000-000000000001')
returns jsonb language plpgsql as $$ declare j public.pick_jobs%rowtype; begin
 select * into strict j from public.pick_jobs;
 return public.apply_viper_pick_command(j.id,j.version,gen_random_uuid(),action,payload,actor);
end $$;
create function pg_temp.reject_command(action text, payload jsonb, message text, actor uuid default '81000000-0000-4000-8000-000000000001')
returns void language plpgsql as $$ begin
 begin
  perform pg_temp.command(action,payload,actor);
  raise exception 'TEST expected rejection';
 exception when sqlstate 'P0001' then assert sqlerrm=message, sqlerrm; end;
end $$;
-- Exercise actual service-role privileges, not only owner execution.
grant execute on function pg_temp.command(text,jsonb,uuid),pg_temp.reject_command(text,jsonb,text,uuid) to service_role;
set local role service_role;
do $$ declare
 j uuid; l uuid; ex uuid; cmd uuid:=gen_random_uuid(); before_version integer;
 response jsonb; replay jsonb; correction jsonb; n integer;
begin
 select id into strict j from public.pick_jobs;
 select id into strict l from public.pick_lines;
 perform pg_temp.command('start');
 assert (select version from public.pick_jobs where id=j)=1;
 response:=public.apply_viper_pick_command(j,1,cmd,'confirm',jsonb_build_object('lineId',l),'81000000-0000-4000-8000-000000000001');
 replay:=public.apply_viper_pick_command(j,1,cmd,'confirm',jsonb_build_object('lineId',l),'81000000-0000-4000-8000-000000000001');
 assert (replay->>'idempotent')::boolean;
 assert (select version from public.pick_jobs)=2;
 assert (select quantity from public.inventory where id='85000000-0000-4000-8000-000000000001')=6;
 correction:=jsonb_build_object('lineId',l,'reason','Wrong button; physically returned','physicalReturnConfirmed',true);
 perform pg_temp.reject_command('undo',correction-'physicalReturnConfirmed','VIPER_RETURN_REQUIRED');
 perform pg_temp.reject_command('undo',correction-'reason','VIPER_REASON_REQUIRED');
 perform pg_temp.reject_command('undo',correction,'VIPER_FORBIDDEN','81000000-0000-4000-8000-000000000002');
 perform pg_temp.command('undo',correction);
 assert (select status from public.pick_lines)='pending';
 begin
  perform public.apply_viper_pick_command(j,1,gen_random_uuid(),'confirm',jsonb_build_object('lineId',l),'81000000-0000-4000-8000-000000000001');
  raise exception 'TEST expected stale';
 exception when sqlstate 'P0001' then assert sqlerrm='VIPER_STALE_VERSION'; end;
 -- Acknowledgement-loss replay after undo must NOT confirm the line again.
 replay:=public.apply_viper_pick_command(j,1,cmd,'confirm',jsonb_build_object('lineId',l),'81000000-0000-4000-8000-000000000001');
 assert (replay->>'idempotent')::boolean and (select status from public.pick_lines)='pending';
 begin
  perform public.apply_viper_pick_command(j,1,cmd,'cancel',correction,'81000000-0000-4000-8000-000000000001');
  raise exception 'TEST expected reused';
 exception when sqlstate 'P0001' then assert sqlerrm='VIPER_COMMAND_REUSED'; end;
 response:=pg_temp.command('report',jsonb_build_object('lineId',l,'exceptionType','damaged'));
 ex:=(response->>'exceptionId')::uuid;
 perform pg_temp.reject_command('confirm',jsonb_build_object('lineId',l),'Pick line has an open exception');
 perform pg_temp.reject_command('resolve',jsonb_build_object('exceptionId',ex,'resolutionNote','Checked'), 'VIPER_FORBIDDEN','81000000-0000-4000-8000-000000000002');
 perform pg_temp.command('resolve',jsonb_build_object('exceptionId',ex,'resolutionNote','Checked'));
 perform pg_temp.command('confirm',jsonb_build_object('lineId',l));
 perform pg_temp.command('cancel',correction);
 assert (select status from public.pick_jobs)='cancelled';
 assert not exists(select 1 from public.stock_movements);
 assert (select quantity from public.inventory where id='85000000-0000-4000-8000-000000000001')=6;
 perform pg_temp.reject_command('reprepare',correction,'VIPER_FORBIDDEN','81000000-0000-4000-8000-000000000002');
 perform pg_temp.command('reprepare',correction);
 assert (select id from public.pick_jobs)=j and (select id from public.pick_lines)=l;
 assert (select status from public.pick_jobs)='ready';
 assert (select assigned_to from public.pick_jobs) is null;
 perform pg_temp.command('start');
 perform pg_temp.command('confirm',jsonb_build_object('lineId',l));
 select version into before_version from public.pick_jobs;
 cmd:=gen_random_uuid();
 response:=public.apply_viper_pick_command(j,before_version,cmd,'complete','{}','81000000-0000-4000-8000-000000000001');
 replay:=public.apply_viper_pick_command(j,before_version,cmd,'complete','{}','81000000-0000-4000-8000-000000000001');
 assert (replay->>'idempotent')::boolean;
 assert (select quantity from public.inventory where id='85000000-0000-4000-8000-000000000001')=1;
 assert (select count(*) from public.stock_movements)=1;
 perform pg_temp.reject_command('cancel',correction,'VIPER_INVALID_STATE');
 perform pg_temp.reject_command('undo',correction,'VIPER_INVALID_STATE');
 assert (select count(*) from public.activity_log where action in ('viper_pick_undo','viper_pick_cancel','viper_pick_reprepare'))=3;
 assert not has_function_privilege('anon','public.apply_viper_pick_command(uuid,integer,uuid,text,jsonb,uuid)','EXECUTE');
 assert not has_function_privilege('authenticated','public.apply_viper_pick_command(uuid,integer,uuid,text,jsonb,uuid)','EXECUTE');
 assert to_regprocedure('public.confirm_viper_pick_line(uuid,uuid,uuid)') is null;
end $$;
reset role;
rollback;

-- Inject a failure AFTER domain updates, at the command receipt insert.
begin;
\ir viper-v2.seed.sql
create function pg_temp.reject_receipt() returns trigger language plpgsql as $$ begin raise exception 'Injected receipt failure'; end $$;
create trigger viper_test_receipt before insert on private.viper_commands for each row execute function pg_temp.reject_receipt();
do $$ declare j uuid; begin
 select id into j from public.pick_jobs;
 begin
  perform public.apply_viper_pick_command(j,0,gen_random_uuid(),'start','{}','81000000-0000-4000-8000-000000000001');
  raise exception 'TEST expected rollback';
 exception when sqlstate 'P0001' then assert sqlerrm='Injected receipt failure'; end;
 assert (select status from public.pick_jobs)='ready';
 assert (select version from public.pick_jobs)=0;
 assert not exists(select 1 from private.viper_commands);
 assert not exists(select 1 from public.viper_events where event_type='pick_started');
 assert not exists(select 1 from public.stock_movements);
end $$;
-- The same injected receipt failure must roll back a completed stock deduction.
drop trigger viper_test_receipt on private.viper_commands;
select public.apply_viper_pick_command(id,version,gen_random_uuid(),'start','{}','81000000-0000-4000-8000-000000000001') from public.pick_jobs;
select public.apply_viper_pick_command(j.id,j.version,gen_random_uuid(),'confirm',jsonb_build_object('lineId',l.id),'81000000-0000-4000-8000-000000000001') from public.pick_jobs j join public.pick_lines l on l.pick_job_id=j.id;
create trigger viper_test_receipt before insert on private.viper_commands for each row execute function pg_temp.reject_receipt();
do $$ declare j public.pick_jobs%rowtype; begin
 select * into strict j from public.pick_jobs;
 begin
  perform public.apply_viper_pick_command(j.id,j.version,gen_random_uuid(),'complete','{}','81000000-0000-4000-8000-000000000001');
  raise exception 'TEST expected completion rollback';
 exception when sqlstate 'P0001' then assert sqlerrm='Injected receipt failure'; end;
 assert (select version from public.pick_jobs)=j.version;
 assert (select status from public.pick_jobs)='in_progress';
 assert (select status from public.orders)='picking';
 assert (select quantity from public.inventory where id='85000000-0000-4000-8000-000000000001')=6;
 assert not exists(select 1 from public.stock_movements);
 assert not exists(select 1 from public.viper_events where event_type='pick_completed');
end $$;
rollback;
\echo 'Viper step 2 commands, receipt replay and rollback PASS'

begin;
\ir viper-v2.seed.sql
select public.apply_viper_pick_command(id,version,gen_random_uuid(),'start','{}','81000000-0000-4000-8000-000000000001') from public.pick_jobs;
do $$ declare other_job uuid; other_order uuid; begin
 insert into public.orders(source,external_order_id,order_number,status) values('manual','second-synthetic','#SECOND','ready_to_pick') returning id into other_order;
 insert into public.pick_jobs(order_id) values(other_order) returning id into other_job;
 begin
  perform public.apply_viper_pick_command(other_job,0,gen_random_uuid(),'start','{}','81000000-0000-4000-8000-000000000002');
  raise exception 'TEST expected single active enforcement';
 exception when sqlstate 'P0001' then assert sqlerrm='Another pilot pick is already active'; end;
 assert (select count(*) from public.pick_jobs where status='in_progress')=1;
 assert (select version from public.pick_jobs where id=other_job)=0;
end $$;
rollback;
