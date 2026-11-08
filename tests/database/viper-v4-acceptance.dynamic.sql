\set ON_ERROR_STOP on
\ir viper-acceptance.guard.sql
begin;
\ir viper-v2.seed.sql
insert into public.products(id,sku,product_name,active,shopify_variant_id) values('84000000-0000-4000-8000-000000000002','VT2','Second synthetic product',true,'gid://shopify/ProductVariant/81002');
insert into public.inventory(id,product_id,location_id,zone_id,quantity,is_primary) values('85000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001',9,true);
create function pg_temp.source(j uuid) returns jsonb language sql as $$
 select jsonb_build_object('externalOrderId',o.external_order_id,'externalUpdatedAt',o.external_updated_at,'observedAt',clock_timestamp(),
 'lines',(select jsonb_agg(jsonb_build_object('externalLineId',external_line_id,'shopifyVariantId',shopify_variant_id,'sku',sku,'requestedQuantity',requested_quantity)) from public.order_lines where order_id=o.id))
 from public.orders o join public.pick_jobs j on j.order_id=o.id where j.id=$1
$$;
create function pg_temp.cmd(j uuid,a text,p jsonb default '{}',actor uuid default '81000000-0000-4000-8000-000000000002') returns jsonb language sql as $$
 select public.apply_viper_pick_command(id,version,gen_random_uuid(),a,p,actor,pg_temp.source(id)) from public.pick_jobs where id=j
$$;
set local role service_role;
do $$ declare j uuid; first_job uuid; l1 uuid; l2 uuid; ex uuid; response jsonb; proof jsonb; v integer; c uuid:=gen_random_uuid(); begin
 select id into first_job from public.pick_jobs;
 response:=public.materialize_viper_shopify_order('gid://shopify/Order/82002','#VT-ACCEPT','2026-11-03','2026-11-03',
 '[{"externalLineId":"SECOND","shopifyVariantId":"gid://shopify/ProductVariant/81002","sku":"VT2","productName":"Second","requestedQuantity":3,"sequenceNumber":1},{"externalLineId":"FIRST","shopifyVariantId":"gid://shopify/ProductVariant/81001","sku":"VT1","productName":"First","requestedQuantity":2,"sequenceNumber":2}]','81000000-0000-4000-8000-000000000001');
 j:=(response->>'pickJobId')::uuid;
 select id into l1 from public.pick_lines where pick_job_id=j and sequence_number=1;
 select id into l2 from public.pick_lines where pick_job_id=j and sequence_number=2;
 assert (select product_id from public.pick_lines where id=l1)='84000000-0000-4000-8000-000000000001'::uuid;
 perform pg_temp.cmd(first_job,'start');
 begin
  perform pg_temp.cmd(j,'start');raise exception 'TEST second active accepted';
 exception when sqlstate 'P0001' then assert sqlerrm='Another pilot pick is already active';end;
 perform pg_temp.cmd(first_job,'cancel','{"reason":"Returned all","physicalReturnConfirmed":true}');
 perform pg_temp.cmd(j,'start');
 perform pg_temp.cmd(j,'confirm',jsonb_build_object('lineId',l1));
 perform pg_temp.cmd(j,'undo',jsonb_build_object('lineId',l1,'reason','Wrong confirmation, returned','physicalReturnConfirmed',true));
 perform pg_temp.cmd(j,'confirm',jsonb_build_object('lineId',l1));
 response:=pg_temp.cmd(j,'report',jsonb_build_object('lineId',l2,'exceptionType','wrong_quantity','observedQuantity',3));
 ex:=(response->>'exceptionId')::uuid;
 begin
  perform pg_temp.cmd(j,'resolve',jsonb_build_object('exceptionId',ex,'resolutionNote','Checked'));raise exception 'TEST picker resolved admin exception';
 exception when sqlstate 'P0001' then assert sqlerrm='VIPER_FORBIDDEN';end;
 begin
  perform pg_temp.cmd(j,'complete');raise exception 'TEST open exception completed';
 exception when sqlstate 'P0001' then assert sqlerrm='Pick job has open exceptions';end;
 perform pg_temp.cmd(j,'resolve',jsonb_build_object('exceptionId',ex,'resolutionNote','Physically checked'),'81000000-0000-4000-8000-000000000001');
 perform pg_temp.cmd(j,'confirm',jsonb_build_object('lineId',l2));
 assert not exists(select 1 from public.stock_movements);
 select version into v from public.pick_jobs where id=j;
 proof:=pg_temp.source(j);
 perform public.apply_viper_pick_command(j,v,c,'complete','{}','81000000-0000-4000-8000-000000000002',proof);
 response:=public.apply_viper_pick_command(j,v,c,'complete','{}','81000000-0000-4000-8000-000000000002');
 assert (response->>'idempotent')::boolean;
 assert (select count(*) from public.stock_movements where pick_job_id=j)=2;
 assert (select quantity from public.inventory where id='85000000-0000-4000-8000-000000000001')=4;
 assert (select quantity from public.inventory where id='85000000-0000-4000-8000-000000000003')=6;
 assert (select status from public.orders where id=(select order_id from public.pick_jobs where id=j))='picked';
 begin
  perform pg_temp.cmd(j,'cancel','{"reason":"Returned","physicalReturnConfirmed":true}');raise exception 'TEST completed cancelled';
 exception when sqlstate 'P0001' then assert sqlerrm='VIPER_INVALID_STATE';end;
 -- Administrator can reprepare the separately cancelled original job, same identity.
 perform pg_temp.cmd(first_job,'reprepare','{"reason":"Ready again","physicalReturnConfirmed":true}','81000000-0000-4000-8000-000000000001');
 assert (select status from public.pick_jobs where id=first_job)='ready';
end $$;
reset role;
-- Verify actual permissions, not merely metadata. No authenticated mutation API.
set local role authenticated;
do $$ begin
 begin
  perform public.apply_viper_pick_command(gen_random_uuid(),0,gen_random_uuid(),'start','{}',gen_random_uuid());
  raise exception 'TEST authenticated executed command';
 exception when insufficient_privilege then null;end;
 begin
  perform 1 from private.viper_commands;raise exception 'TEST private receipts exposed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.get_viper_pick_command_result(gen_random_uuid(),0,gen_random_uuid(),'complete','{}',gen_random_uuid());
  raise exception 'TEST anonymous recovery exposed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
\echo 'Viper V1 multi-line import-to-completion and permissions PASS'
