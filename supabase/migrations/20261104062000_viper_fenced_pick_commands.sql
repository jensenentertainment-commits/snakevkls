-- Viper step 2. One exposed command path; existing stock completion stays intact.
alter table public.pick_jobs add column version integer not null default 0 check (version >= 0);
create table private.viper_commands (
 pick_job_id uuid not null references public.pick_jobs(id) on delete restrict,
 command_id uuid not null,
 request jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(pick_job_id,command_id)
);
alter table private.viper_commands enable row level security;
revoke all on private.viper_commands from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on private.viper_commands to service_role;

-- Keep proven mutations as internal INVOKER helpers. No unfenced public RPC remains.
alter function public.start_viper_pick(uuid,uuid,text,text,uuid) set schema private;
alter function public.confirm_viper_pick_line(uuid,uuid,uuid) set schema private;
alter function public.report_viper_pick_exception(uuid,text,integer,text,uuid,text,text,uuid) set schema private;
alter function public.resolve_viper_pick_exception(uuid,text,uuid,text,text,uuid) set schema private;
alter function public.complete_viper_pick(uuid,uuid,text,text,uuid) set schema private;

create function public.apply_viper_pick_command(
 requested_pick_job_id uuid,
 requested_expected_version integer,
 requested_command_id uuid,
 requested_action text,
 requested_payload jsonb,
 requested_actor_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 job public.pick_jobs%rowtype;
 actor public.profiles%rowtype;
 previous private.viper_commands%rowtype;
 fingerprint jsonb;
 result jsonb;
 target_line uuid;
 target_exception uuid;
 reason text;
 before_lines jsonb;
begin
 if requested_command_id is null or requested_expected_version is null or requested_expected_version < 0
   or requested_actor_id is null or requested_action is null
   or requested_payload is null or jsonb_typeof(requested_payload) <> 'object'
   or requested_action not in ('start','confirm','report','resolve','complete','undo','cancel','reprepare')
 then raise exception 'VIPER_INVALID_COMMAND'; end if;
 select * into actor from public.profiles where id=requested_actor_id and active
   and role in ('admin','user','warehouse');
 if not found then raise exception 'VIPER_FORBIDDEN'; end if;
 -- Admission lock precedes the job lock, matching the existing start helper.
 if requested_action='start' then
   perform pg_advisory_xact_lock(hashtextextended('viper_pilot_active_pick',0));
 end if;
 select * into job from public.pick_jobs where id=requested_pick_job_id for update;
 if not found then raise exception 'VIPER_NOT_FOUND'; end if;
 fingerprint:=jsonb_build_object('actorId',requested_actor_id,'action',requested_action,
   'expectedVersion',requested_expected_version,'payload',requested_payload);
 select * into previous from private.viper_commands
   where pick_job_id=job.id and command_id=requested_command_id;
 if found then
   if previous.request <> fingerprint then raise exception 'VIPER_COMMAND_REUSED'; end if;
   return previous.result || jsonb_build_object('idempotent',true);
 end if;
 if requested_action in ('resolve','reprepare') and actor.role <> 'admin'
   then raise exception 'VIPER_FORBIDDEN'; end if;
 if requested_action in ('confirm','report','complete','undo') and job.assigned_to is distinct from requested_actor_id
   then raise exception 'VIPER_FORBIDDEN'; end if;
 if requested_action='cancel' and actor.role <> 'admin' and job.assigned_to is distinct from requested_actor_id
   then raise exception 'VIPER_FORBIDDEN'; end if;
 if job.version <> requested_expected_version then raise exception 'VIPER_STALE_VERSION'; end if;
 -- Every helper now enters with these locks already held. Stable row ordering.
 perform 1 from public.orders where id=job.order_id for update;
 perform 1 from public.pick_lines where pick_job_id=job.id order by id for update;
 perform 1 from public.pick_exceptions where pick_job_id=job.id order by id for update;
 if requested_action in ('confirm','report','undo') then
   target_line:=(requested_payload->>'lineId')::uuid;
   if not exists(select 1 from public.pick_lines where id=target_line and pick_job_id=job.id)
     then raise exception 'VIPER_NOT_FOUND'; end if;
 end if;
 if requested_action='resolve' then
   target_exception:=(requested_payload->>'exceptionId')::uuid;
   if not exists(select 1 from public.pick_exceptions where id=target_exception and pick_job_id=job.id)
     then raise exception 'VIPER_NOT_FOUND'; end if;
   if job.status <> 'in_progress' then raise exception 'VIPER_INVALID_STATE'; end if;
 end if;
 reason:=nullif(btrim(requested_payload->>'reason'),'');
 if requested_action in ('undo','cancel','reprepare') then
   if reason is null or length(reason)>1000 then raise exception 'VIPER_REASON_REQUIRED'; end if;
   if (requested_payload->>'physicalReturnConfirmed')::boolean is distinct from true
     then raise exception 'VIPER_RETURN_REQUIRED'; end if;
   select jsonb_agg(jsonb_build_object('lineId',id,'status',status,'pickedQuantity',picked_quantity,'pickedBy',picked_by) order by id)
     into before_lines from public.pick_lines where pick_job_id=job.id;
 end if;
 case requested_action
 when 'start' then
   result:=private.start_viper_pick(job.id,actor.id,actor.email,actor.display_name,requested_command_id);
 when 'confirm' then
   result:=private.confirm_viper_pick_line(target_line,actor.id,requested_command_id);
 when 'report' then
   result:=private.report_viper_pick_exception(target_line,requested_payload->>'exceptionType',
     (requested_payload->>'observedQuantity')::integer,requested_payload->>'note',actor.id,actor.email,actor.display_name,requested_command_id);
 when 'resolve' then
   result:=private.resolve_viper_pick_exception(target_exception,requested_payload->>'resolutionNote',actor.id,actor.email,actor.display_name,requested_command_id);
 when 'complete' then
   result:=private.complete_viper_pick(job.id,actor.id,actor.email,actor.display_name,requested_command_id);
 when 'undo' then
   if job.status <> 'in_progress' or not exists(select 1 from public.pick_lines where id=target_line and status='picked')
     then raise exception 'VIPER_INVALID_STATE'; end if;
   update public.pick_lines set status='pending',picked_quantity=0,picked_at=null,picked_by=null,updated_at=now() where id=target_line;
 when 'cancel' then
   if job.status not in ('ready','in_progress') then raise exception 'VIPER_INVALID_STATE'; end if;
   update public.pick_exceptions set status='resolved',resolved_by=actor.id,resolved_at=now(),
     resolution_note='Cancelled: '||reason,updated_at=now() where pick_job_id=job.id and status='open';
   update public.pick_lines set status='cancelled',picked_quantity=0,picked_at=null,picked_by=null,updated_at=now() where pick_job_id=job.id;
   update public.pick_jobs set status='cancelled',updated_at=now() where id=job.id;
   update public.orders set status='cancelled',updated_at=now() where id=job.order_id;
 when 'reprepare' then
   if job.status <> 'cancelled' or not exists(select 1 from public.orders where id=job.order_id and status='cancelled')
     or exists(select 1 from public.stock_movements where pick_job_id=job.id)
     or exists(select 1 from public.pick_exceptions where pick_job_id=job.id and status='open')
     then raise exception 'VIPER_INVALID_STATE'; end if;
   update public.pick_lines set status='pending',picked_quantity=0,picked_at=null,picked_by=null,updated_at=now() where pick_job_id=job.id;
   update public.pick_jobs set status='ready',assigned_to=null,started_at=null,completed_at=null,updated_at=now() where id=job.id;
   update public.orders set status='ready_to_pick',updated_at=now() where id=job.order_id;
 end case;
 update public.pick_jobs set version=version+1,updated_at=now() where id=job.id returning * into job;
 result:=coalesce(result,'{}'::jsonb)||jsonb_build_object('pickJobId',job.id,'version',job.version,'status',job.status,'idempotent',false);
 insert into public.viper_events(event_type,order_id,pick_job_id,pick_line_id,actor_id,actor_type,correlation_id,source,payload)
 values('pick_command_'||requested_action,job.order_id,job.id,target_line,actor.id,'user',requested_command_id,'viper',
   jsonb_build_object('version',job.version,'reason',reason,'physicalReturnConfirmed',requested_payload->'physicalReturnConfirmed','previousLines',before_lines));
 if requested_action in ('undo','cancel','reprepare') then
   insert into public.activity_log(entity_type,entity_id,action,title,metadata,actor_id,actor_email,actor_name)
   values('pick_job',job.id,'viper_pick_'||requested_action,'Viper korrigering',
     jsonb_build_object('reason',reason,'version',job.version,'physicalReturnConfirmed',true,'commandId',requested_command_id),actor.id,actor.email,actor.display_name);
 end if;
 insert into private.viper_commands(pick_job_id,command_id,request,result) values(job.id,requested_command_id,fingerprint,result);
 return result;
end $$;
revoke all on function public.apply_viper_pick_command(uuid,integer,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.apply_viper_pick_command(uuid,integer,uuid,text,jsonb,uuid) to service_role;
