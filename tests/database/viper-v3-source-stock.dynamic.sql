\set ON_ERROR_STOP on
\ir viper-acceptance.guard.sql
begin;
\ir viper-v2.seed.sql
create function pg_temp.proof(j uuid) returns jsonb language sql as $$
 select jsonb_build_object('externalOrderId',o.external_order_id,'externalUpdatedAt',o.external_updated_at,'observedAt',clock_timestamp(),
 'lines',(select jsonb_agg(jsonb_build_object('externalLineId',external_line_id,'shopifyVariantId',shopify_variant_id,'sku',sku,'requestedQuantity',requested_quantity)) from public.order_lines where order_id=o.id))
 from public.orders o join public.pick_jobs j on j.order_id=o.id where j.id=$1
$$;
create function pg_temp.act(action text,payload jsonb default '{}') returns jsonb language plpgsql as $$
declare j public.pick_jobs%rowtype; begin
 select * into strict j from public.pick_jobs;
 return public.apply_viper_pick_command(j.id,j.version,gen_random_uuid(),action,payload,'81000000-0000-4000-8000-000000000001',pg_temp.proof(j.id));
end $$;
create function pg_temp.reject(action text, expected_error text) returns void language plpgsql as $$
declare j public.pick_jobs%rowtype; before_stock jsonb; begin
 select * into strict j from public.pick_jobs;
 select jsonb_agg(to_jsonb(i) order by id) into before_stock from public.inventory i;
 begin
  perform pg_temp.act(action);
  raise exception 'TEST expected rejection';
 exception when sqlstate 'P0001' then assert sqlerrm=expected_error,sqlerrm; end;
 assert (select version from public.pick_jobs)=j.version;
 assert (select status from public.pick_jobs)=j.status;
 assert (select jsonb_agg(to_jsonb(i) order by id) from public.inventory i)=before_stock;
 assert not exists(select 1 from public.stock_movements);
end $$;
update public.inventory set quantity=1 where id='85000000-0000-4000-8000-000000000001';
select pg_temp.reject('start','VIPER_STOCK_CHANGED');
update public.inventory set quantity=6 where id='85000000-0000-4000-8000-000000000001';
update public.inventory set location_id='83000000-0000-4000-8000-000000000003' where id='85000000-0000-4000-8000-000000000001';
select pg_temp.reject('start','VIPER_STOCK_CHANGED');
update public.inventory set location_id='83000000-0000-4000-8000-000000000001' where id='85000000-0000-4000-8000-000000000001';
update public.locations set active=false where code='VT-PICK';
select pg_temp.reject('start','VIPER_LOCATION_CHANGED');
update public.locations set active=true where code='VT-PICK';
update public.zones set active=false where code='VT';
select pg_temp.reject('start','VIPER_LOCATION_CHANGED');
update public.zones set active=true where code='VT';
update public.products set active=false;
select pg_temp.reject('start','VIPER_LOCATION_CHANGED');
update public.products set active=true;
update public.locations set pick_sequence=null where code='VT-PICK';
select pg_temp.reject('start','VIPER_LOCATION_CHANGED');
update public.locations set pick_sequence=1 where code='VT-PICK';
do $$ declare j public.pick_jobs%rowtype; proof jsonb; l uuid; c uuid:=gen_random_uuid(); begin
 select * into strict j from public.pick_jobs;
 select id into strict l from public.pick_lines;
 proof:=pg_temp.proof(j.id);
 update public.orders set external_updated_at=external_updated_at+interval '1 second';
 begin
  perform public.apply_viper_pick_command(j.id,0,c,'start','{}','81000000-0000-4000-8000-000000000001',proof);
  raise exception 'TEST expected changed source';
 exception when sqlstate 'P0001' then assert sqlerrm='VIPER_SOURCE_CHANGED'; end;
 update public.orders set external_updated_at=external_updated_at-interval '1 second';
 update public.order_lines set requested_quantity=requested_quantity+1;
 begin
  perform public.apply_viper_pick_command(j.id,0,c,'start','{}','81000000-0000-4000-8000-000000000001',proof);
  raise exception 'TEST expected changed stored lines';
 exception when sqlstate 'P0001' then assert sqlerrm='VIPER_SOURCE_CHANGED'; end;
 update public.order_lines set requested_quantity=requested_quantity-1;
 begin
  perform public.apply_viper_pick_command(j.id,0,c,'start','{}','81000000-0000-4000-8000-000000000001',proof||jsonb_build_object('observedAt',clock_timestamp()-interval '31 seconds'));
  raise exception 'TEST expected expired';
 exception when sqlstate 'P0001' then assert sqlerrm='VIPER_SOURCE_EXPIRED'; end;
 begin
  perform public.apply_viper_pick_command(j.id,0,c,'start','{}','81000000-0000-4000-8000-000000000001');
  raise exception 'TEST expected missing proof';
 exception when sqlstate 'P0001' then assert sqlerrm='VIPER_SOURCE_REQUIRED'; end;
 perform public.apply_viper_pick_command(j.id,0,c,'start','{}','81000000-0000-4000-8000-000000000001',pg_temp.proof(j.id));
 assert (public.apply_viper_pick_command(j.id,0,c,'start','{}','81000000-0000-4000-8000-000000000001')->>'idempotent')::boolean;
 assert (public.get_viper_pick_command_result(j.id,0,c,'start','{}','81000000-0000-4000-8000-000000000001')->>'idempotent')::boolean;
 perform pg_temp.act('confirm',jsonb_build_object('lineId',l));
 perform pg_temp.act('undo',jsonb_build_object('lineId',l,'reason','Returned','physicalReturnConfirmed',true));
 perform pg_temp.act('cancel','{"reason":"Returned","physicalReturnConfirmed":true}');
 perform pg_temp.act('reprepare','{"reason":"Checked","physicalReturnConfirmed":true}');
 assert (select id from public.pick_lines)=l;
 perform pg_temp.act('start');
 perform pg_temp.act('confirm',jsonb_build_object('lineId',l));
end $$;
update public.inventory set quantity=1 where id='85000000-0000-4000-8000-000000000001';
select pg_temp.reject('complete','VIPER_STOCK_CHANGED');
update public.inventory set quantity=6 where id='85000000-0000-4000-8000-000000000001';
update public.locations set active=false where code='VT-PICK';
select pg_temp.reject('complete','VIPER_LOCATION_CHANGED');
update public.locations set active=true where code='VT-PICK';
-- Failure after completion but before source audit must roll back the deduction.
create function pg_temp.reject_audit() returns trigger language plpgsql as $$ begin
 if new.event_type='pick_source_checked' then raise exception 'Injected source audit failure'; end if;
 return new;
end $$;
create trigger viper_fixture_source_failure before insert on public.viper_events for each row execute function pg_temp.reject_audit();
select pg_temp.reject('complete','Injected source audit failure');
drop trigger viper_fixture_source_failure on public.viper_events;
set local role service_role;
do $$ declare j public.pick_jobs%rowtype; c uuid:=gen_random_uuid(); begin
 select * into strict j from public.pick_jobs;
 perform public.apply_viper_pick_command(j.id,j.version,c,'complete','{}','81000000-0000-4000-8000-000000000001',pg_temp.proof(j.id));
 assert (public.get_viper_pick_command_result(j.id,j.version,c,'complete','{}','81000000-0000-4000-8000-000000000001')->>'idempotent')::boolean;
 assert (public.get_viper_pick_command_result(j.id,j.version,gen_random_uuid(),'complete','{}','81000000-0000-4000-8000-000000000001')->>'status')='completed';
 assert (select count(*) from public.stock_movements)=1;
 assert not has_function_privilege('authenticated','public.apply_viper_pick_command(uuid,integer,uuid,text,jsonb,uuid,jsonb)','EXECUTE');
 assert not has_function_privilege('anon','public.get_viper_pick_command_result(uuid,integer,uuid,text,jsonb,uuid)','EXECUTE');
end $$;
reset role;
rollback;
\echo 'Step 3 source/stock/status/recovery PASS'
