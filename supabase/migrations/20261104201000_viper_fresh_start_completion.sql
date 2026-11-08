-- Step 3: network observations are supplied only by the authenticated server.
-- No network work while database locks are held. No historical data rewrite.
alter function public.apply_viper_pick_command(uuid,integer,uuid,text,jsonb,uuid) set schema private;
create function public.get_viper_pick_command_result(
 requested_pick_job_id uuid,requested_expected_version integer,requested_command_id uuid,
 requested_action text,requested_payload jsonb,requested_actor_id uuid
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare receipt private.viper_commands%rowtype; job public.pick_jobs%rowtype;
begin
 if not exists(select 1 from public.profiles where id=requested_actor_id and active and role in ('admin','user','warehouse')) then raise exception 'VIPER_FORBIDDEN'; end if;
 select * into receipt from private.viper_commands where pick_job_id=requested_pick_job_id and command_id=requested_command_id;
 if found then
   if receipt.request is distinct from jsonb_build_object('actorId',requested_actor_id,'action',requested_action,'expectedVersion',requested_expected_version,'payload',requested_payload)
     then raise exception 'VIPER_COMMAND_REUSED'; end if;
   return receipt.result||jsonb_build_object('idempotent',true);
 end if;
 -- Completed state is immutable; recover a committed completion after page reload.
 select * into job from public.pick_jobs where id=requested_pick_job_id;
 if requested_action='complete' and job.status='completed' and job.assigned_to=requested_actor_id
   and exists(select 1 from public.orders where id=job.order_id and status='picked') then
   return jsonb_build_object('pickJobId',job.id,'orderId',job.order_id,'status','completed','version',job.version,'completedAt',job.completed_at,'idempotent',true);
 end if;
 return null;
end $$;
revoke all on function public.get_viper_pick_command_result(uuid,integer,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.get_viper_pick_command_result(uuid,integer,uuid,text,jsonb,uuid) to service_role;

create function public.apply_viper_pick_command(
 requested_pick_job_id uuid,requested_expected_version integer,requested_command_id uuid,
 requested_action text,requested_payload jsonb,requested_actor_id uuid,requested_source jsonb default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 job public.pick_jobs%rowtype; ord public.orders%rowtype; recovered jsonb;
 observed_at timestamptz; observed_update timestamptz; actual_lines jsonb; supplied_lines jsonb;
 line record; result jsonb;
begin
 if requested_action not in ('start','complete') then
   return private.apply_viper_pick_command(requested_pick_job_id,requested_expected_version,requested_command_id,requested_action,requested_payload,requested_actor_id);
 end if;
 if requested_action='start' then perform pg_advisory_xact_lock(hashtextextended('viper_pilot_active_pick',0)); end if;
 select * into job from public.pick_jobs where id=requested_pick_job_id for update;
 if not found then raise exception 'VIPER_NOT_FOUND'; end if;
 recovered:=public.get_viper_pick_command_result(job.id,requested_expected_version,requested_command_id,requested_action,requested_payload,requested_actor_id);
 if recovered is not null then return recovered; end if;
 if job.version is distinct from requested_expected_version then raise exception 'VIPER_STALE_VERSION'; end if;
 if requested_action='complete' and job.assigned_to is distinct from requested_actor_id then raise exception 'VIPER_FORBIDDEN'; end if;
 select * into ord from public.orders where id=job.order_id for update;
 perform 1 from public.pick_lines where pick_job_id=job.id order by id for update;
 -- Imported source lines also remain stable until commit (non-key edits do not lock the parent order).
 perform 1 from public.order_lines where order_id=ord.id order by id for share;
 perform 1 from public.pick_exceptions where pick_job_id=job.id order by id for update;
 if ord.source='shopify' then
   if requested_source is null or jsonb_typeof(requested_source) <> 'object'
     or requested_source->>'externalOrderId' is distinct from ord.external_order_id
     or jsonb_typeof(requested_source->'lines') is distinct from 'array'
     then raise exception 'VIPER_SOURCE_REQUIRED'; end if;
   observed_at:=(requested_source->>'observedAt')::timestamptz;
   observed_update:=(requested_source->>'externalUpdatedAt')::timestamptz;
   if observed_at is null or observed_at < clock_timestamp()-interval '30 seconds'
     or observed_at > clock_timestamp()+interval '5 seconds' then raise exception 'VIPER_SOURCE_EXPIRED'; end if;
   if observed_update is null or observed_update is distinct from ord.external_updated_at then raise exception 'VIPER_SOURCE_CHANGED'; end if;
   select jsonb_agg(jsonb_build_object('externalLineId',external_line_id,'shopifyVariantId',shopify_variant_id,'sku',sku,'requestedQuantity',requested_quantity) order by external_line_id)
     into actual_lines from public.order_lines where order_id=ord.id;
   select jsonb_agg(value order by value->>'externalLineId') into supplied_lines from jsonb_array_elements(requested_source->'lines');
   if actual_lines is null or actual_lines is distinct from supplied_lines then raise exception 'VIPER_SOURCE_CHANGED'; end if;
 end if;
 -- Product before inventory matches existing warehouse upsert/batch-zone order.
 -- SHARE protects active flags/identity without upgrading warehouse row locks.
 perform 1 from public.products where id in(select product_id from public.pick_lines where pick_job_id=job.id) order by id for share;
 perform 1 from public.locations where id in(select location_id from public.pick_lines where pick_job_id=job.id) order by id for share;
 perform 1 from public.zones where id in(select zone_id from public.locations where id in(select location_id from public.pick_lines where pick_job_id=job.id)) order by id for share;
 perform 1 from public.inventory where id in(select inventory_id from public.pick_lines where pick_job_id=job.id) order by id for update;
 if not exists(select 1 from public.pick_lines where pick_job_id=job.id) then raise exception 'VIPER_STOCK_CHANGED'; end if;
 for line in
   select pl.*,i.id as current_inventory_id,i.quantity,i.product_id as current_product,i.location_id as current_location,i.zone_id as inventory_zone,
     p.active as product_active,p.shopify_variant_id as current_variant,p.sku as current_sku,
     loc.active as location_active,loc.zone_id,loc.pick_sequence,z.active as zone_active,z.pick_priority,
     ol.shopify_variant_id,ol.sku,ol.requested_quantity,ol.order_id as line_order,
     row_number() over(order by z.pick_priority,loc.pick_sequence,loc.id,ol.external_line_id) as physical_sequence
   from public.pick_lines pl left join public.inventory i on i.id=pl.inventory_id
   left join public.products p on p.id=pl.product_id left join public.locations loc on loc.id=pl.location_id
   left join public.zones z on z.id=loc.zone_id left join public.order_lines ol on ol.id=pl.order_line_id
   where pl.pick_job_id=job.id
 loop
   if line.current_inventory_id is null or line.current_product is distinct from line.product_id
     or line.current_location is distinct from line.location_id or line.inventory_zone is distinct from line.zone_id
     or line.quantity < line.expected_quantity or line.requested_quantity is distinct from line.expected_quantity
     or line.line_order is distinct from ord.id then raise exception 'VIPER_STOCK_CHANGED'; end if;
   if line.product_active is distinct from true or line.location_active is distinct from true or line.zone_active is distinct from true
     or line.pick_sequence is null or line.pick_priority is null or line.sequence_number <> line.physical_sequence
     or (ord.source='shopify' and line.current_variant is distinct from line.shopify_variant_id)
     or (line.sku is not null and line.current_sku is not null and lower(btrim(line.sku))<>lower(btrim(line.current_sku)))
     then raise exception 'VIPER_LOCATION_CHANGED'; end if;
 end loop;
 -- Recheck age AFTER lock waits, immediately before writes.
 if ord.source='shopify' and observed_at < clock_timestamp()-interval '30 seconds' then raise exception 'VIPER_SOURCE_EXPIRED'; end if;
 result:=private.apply_viper_pick_command(job.id,requested_expected_version,requested_command_id,requested_action,requested_payload,requested_actor_id);
 insert into public.viper_events(event_type,order_id,pick_job_id,actor_id,actor_type,correlation_id,source,payload)
 values('pick_source_checked',ord.id,job.id,requested_actor_id,'user',requested_command_id,'viper',
   jsonb_build_object('action',requested_action,'shopifyUpdatedAt',observed_update,'observedAt',observed_at));
 return result;
end $$;
revoke all on function public.apply_viper_pick_command(uuid,integer,uuid,text,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_viper_pick_command(uuid,integer,uuid,text,jsonb,uuid,jsonb) to service_role;
