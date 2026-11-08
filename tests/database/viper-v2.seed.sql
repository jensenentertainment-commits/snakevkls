\ir viper-acceptance.guard.sql
-- Caller controls the transaction. Exact synthetic population only.
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

insert into auth.users(id) values ('81000000-0000-4000-8000-000000000002');
insert into public.profiles(id,email,role,display_name,active) values
 ('81000000-0000-4000-8000-000000000002','picker@example.test','user','Synthetic picker',true);
select public.materialize_viper_shopify_order('gid://shopify/Order/82001','#VT2',
 '2026-11-03','2026-11-03',
 '[{"externalLineId":"L1","shopifyVariantId":"gid://shopify/ProductVariant/81001","sku":"VT1","productName":"Test product","requestedQuantity":5,"sequenceNumber":1}]',
 '81000000-0000-4000-8000-000000000001');
