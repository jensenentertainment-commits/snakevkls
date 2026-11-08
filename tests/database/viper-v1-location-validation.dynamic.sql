\set ON_ERROR_STOP on
-- Run only against a separately prepared, disposable Viper database.
-- No connection defaults, production credentials or retained Roy targets.
\ir viper-acceptance.guard.sql
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
do $$ begin
  if exists(select 1 from public.orders) or exists(select 1 from public.inventory)
    or exists(select 1 from public.products)
  then raise exception 'Empty application populations required'; end if;
end $$;

insert into auth.users(id) values ('81000000-0000-4000-8000-000000000001');
insert into public.profiles(id,email,role,display_name,active) values
 ('81000000-0000-4000-8000-000000000001','viper-test@example.test','admin','Viper test',true);
insert into public.zones(id,code,name,pick_priority) values
 ('82000000-0000-4000-8000-000000000001','VT','Acceptance only',100);
insert into public.locations(id,code,zone_id,pick_sequence,location_purpose) values
 ('83000000-0000-4000-8000-000000000001','VT-PICK','82000000-0000-4000-8000-000000000001',1,'PICK'),
 ('83000000-0000-4000-8000-000000000002','VT-BUFFER','82000000-0000-4000-8000-000000000001',2,'BUFFER'),
 ('83000000-0000-4000-8000-000000000003','VT-PICK2','82000000-0000-4000-8000-000000000001',3,'PICK');
insert into public.products(id,sku,product_name,active,shopify_variant_id) values
 ('84000000-0000-4000-8000-000000000001','VT1','Test product',true,'gid://shopify/ProductVariant/81001');
insert into public.inventory(id,product_id,location_id,zone_id,quantity,is_primary) values
 ('85000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',6,false),
 ('85000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001',8,true);

do $$
declare
 lines jsonb := '[{"externalLineId":"L1","shopifyVariantId":"gid://shopify/ProductVariant/81001","sku":"VT1","productName":"Test product","requestedQuantity":5,"sequenceNumber":1}]';
 selected jsonb; imported jsonb; replay jsonb; stock jsonb;
begin
 select jsonb_agg(to_jsonb(i) order by id) into stock from public.inventory i;
 selected := public.validate_viper_order_lines(lines);
 assert selected->0->>'locationCode' = 'VT-PICK', 'PICK must win over primary BUFFER';
 assert (select jsonb_agg(to_jsonb(i) order by id) from public.inventory i) = stock, 'Preview must not write stock';
 assert not exists(select 1 from public.orders), 'Preview must not import';

 update public.inventory set quantity=3 where id='85000000-0000-4000-8000-000000000001';
 selected := public.validate_viper_order_lines(lines);
 assert selected->0->>'locationCode' = 'VT-BUFFER', 'BUFFER fallback';
 update public.inventory set quantity=3 where id='85000000-0000-4000-8000-000000000002';
 begin
   perform public.validate_viper_order_lines(lines);
   raise exception 'TEST expected stock rejection';
 exception when sqlstate 'P0001' then
   assert sqlerrm = 'INSUFFICIENT_PHYSICAL_STOCK', 'Never sum split inventory';
 end;
 update public.inventory set quantity=8;
 insert into public.inventory(id,product_id,location_id,zone_id,quantity,is_primary) values
 ('85000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001',8,false);
 begin
   perform public.validate_viper_order_lines(lines);
   raise exception 'TEST expected ambiguity';
 exception when sqlstate 'P0001' then assert sqlerrm = 'PICK_LOCATION_AMBIGUOUS'; end;
 update public.inventory set is_primary=false;
 update public.inventory set is_primary=true where id='85000000-0000-4000-8000-000000000001';
 assert public.validate_viper_order_lines(lines)->0->>'locationCode' = 'VT-PICK';
 update public.locations set pick_sequence=null where code='VT-PICK';
 begin
   perform public.validate_viper_order_lines(lines);
   raise exception 'TEST expected physical order rejection';
 exception when sqlstate 'P0001' then assert sqlerrm = 'PICK_ORDER_MISSING'; end;
 update public.locations set pick_sequence=1 where code='VT-PICK';
 update public.zones set active=false where code='VT';
 begin
   perform public.validate_viper_order_lines(lines);
   raise exception 'TEST expected inactive zone rejection';
 exception when sqlstate 'P0001' then assert sqlerrm = 'LOCATION_INACTIVE'; end;
 update public.zones set active=true where code='VT';

 selected := public.validate_viper_order_lines(lines);
 imported := public.materialize_viper_shopify_order('gid://shopify/Order/81001','#VT1',
   '2026-11-03T00:00:00Z','2026-11-03T00:00:00Z',lines,'81000000-0000-4000-8000-000000000001');
 assert (select inventory_id::text from public.pick_lines where pick_job_id=(imported->>'pickJobId')::uuid)
   = selected->0->>'inventoryId', 'Preview and import identity';
 replay := public.materialize_viper_shopify_order('gid://shopify/Order/81001','#VT1',
   '2026-11-03T00:00:00Z','2026-11-03T00:00:00Z',lines,'81000000-0000-4000-8000-000000000001');
 assert (replay->>'idempotent')::boolean and replay->>'pickJobId'=imported->>'pickJobId';
 assert (select count(*) from public.orders)=1;
 assert not has_function_privilege('authenticated','public.validate_viper_order_lines(jsonb)','EXECUTE');
 assert not has_function_privilege('anon','public.validate_viper_order_lines(jsonb)','EXECUTE');
 assert has_function_privilege('service_role','public.validate_viper_order_lines(jsonb)','EXECUTE');
end $$;

create function pg_temp.reject_viper_fixture_line() returns trigger language plpgsql as $$
begin raise exception using errcode='P0001', message='Viper fixture injected failure'; end $$;
create trigger viper_fixture_failure before insert on public.pick_lines
for each row execute function pg_temp.reject_viper_fixture_line();
do $$ begin
  begin
    perform public.materialize_viper_shopify_order('gid://shopify/Order/81002','#VT2',
      '2026-11-03T00:00:00Z','2026-11-03T00:00:00Z',
      '[{"externalLineId":"L2","shopifyVariantId":"gid://shopify/ProductVariant/81001","sku":"VT1","productName":"Test","requestedQuantity":1,"sequenceNumber":1}]',
      '81000000-0000-4000-8000-000000000001');
    raise exception 'TEST expected injected failure';
  exception when sqlstate 'P0001' then assert sqlerrm = 'Viper fixture injected failure'; end;
  assert (select count(*) from public.orders)=1, 'Failed import must roll back its order';
  assert (select count(*) from public.pick_jobs)=1, 'Failed import must roll back its job';
  assert not exists(select 1 from public.stock_movements), 'Import must never deduct stock';
end $$;
rollback;
\echo 'Viper V1 location validation passed; fixture rolled back'
