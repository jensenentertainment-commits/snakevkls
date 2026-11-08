\ir roy-phase-2a-acceptance.guard.sql
begin;
\ir roy-phase-2a-targeted.helpers.sql
do $$
declare
 actor uuid:='96000000-0000-4000-8000-000000000001'; z uuid; loc uuid; p uuid; inv uuid;
 imported jsonb; lines jsonb; proof jsonb; job uuid; line uuid; command uuid:=gen_random_uuid(); result jsonb;
 sale uuid:=gen_random_uuid(); sale_result jsonb; sale_lines jsonb;
begin
 insert into public.zones(code,name,pick_priority) values('CV','Catalog Viper fixture',212) returning id into z;
 insert into public.locations(code,zone_id,pick_sequence,location_purpose) values('CV01',z,1,'PICK') returning id into loc;
 -- Synthetic identifiers only; no Shopify resource is looked up or modified.
 insert into public.products(sku,product_name,shopify_product_id,shopify_variant_id,shopify_inventory_item_id,shopify_inventory_level_id,shopify_price_minor,shopify_price_currency,shopify_inventory_tracked,shopify_inventory_location_id,shopify_inventory_observed_at,shopify_quantity)
 values('DUP','Catalog fixture','gid://shopify/Product/98701','gid://shopify/ProductVariant/98701','gid://shopify/InventoryItem/98701','gid://shopify/InventoryLevel/98701?inventory_item_id=98701',100,'NOK',true,'gid://shopify/Location/98701',now(),10) returning id into p;
 insert into public.products(sku,product_name,shopify_variant_id) values('DUP','Different variant, same SKU','gid://shopify/ProductVariant/98702');
 insert into public.inventory(product_id,location_id,zone_id,quantity) values(p,loc,z,10) returning id into inv;
 lines:=jsonb_build_array(jsonb_build_object('externalLineId','CV-L1','shopifyVariantId','gid://shopify/ProductVariant/98701','sku','OLD-SKU','productName','Fixture','requestedQuantity',1,'sequenceNumber',1));
 assert public.validate_viper_order_lines(lines)->0->>'productId'=p::text,'Variant-ID wins over duplicate/different SKU';
 assert public.validate_viper_order_lines(jsonb_set(lines,'{0,sku}','null'))->0->>'productId'=p::text;
 imported:=public.materialize_viper_shopify_order('gid://shopify/Order/98701','#CV','2026-11-01T00:00:00Z',now(),lines,actor);
 job:=(imported->>'pickJobId')::uuid;
 assert (select product_id=p from public.order_lines where order_id=(imported->>'orderId')::uuid);
 assert public.materialize_viper_shopify_order('gid://shopify/Order/98701','#CV','2026-11-01T00:00:00Z',now(),lines,actor)->>'idempotent'='true';
 proof:=jsonb_build_object('externalOrderId','gid://shopify/Order/98701','externalUpdatedAt','2026-11-01T00:00:00Z','observedAt',clock_timestamp(),
   'lines',jsonb_build_array(jsonb_build_object('externalLineId','CV-L1','shopifyVariantId','gid://shopify/ProductVariant/98701','sku','OLD-SKU','requestedQuantity',1)));
 perform public.apply_viper_pick_command(job,0,gen_random_uuid(),'start','{}',actor,proof);
 select id into strict line from public.pick_lines where pick_job_id=job;
 perform public.apply_viper_pick_command(job,1,gen_random_uuid(),'confirm',jsonb_build_object('lineId',line),actor,null);
 assert (select quantity=10 from public.inventory where id=inv);
 update public.products set sku=null where id=p;
 proof:=jsonb_set(proof,'{observedAt}',to_jsonb(clock_timestamp()));
 result:=public.apply_viper_pick_command(job,2,command,'complete','{}',actor,proof);
 assert (select quantity=9 from public.inventory where id=inv);
 assert public.apply_viper_pick_command(job,2,command,'complete','{}',actor,null)->>'idempotent'='true';
 assert (select quantity=9 from public.inventory where id=inv),'No second stock deduction';
 assert (select count(*)=1 from public.stock_movements where product_id=p);
 -- Real Lagersalg SQL only creates its local outbox; no Shopify request exists here.
 insert into public.shopify_connections(shop,access_token,scopes,inventory_location_id,inventory_location_name,inventory_location_configured_at)
 values('fixture.myshopify.com','synthetic-not-a-token','write_inventory','gid://shopify/Location/98701','Fixture',now());
 sale_lines:=jsonb_build_array(jsonb_build_object('productId',p,'quantity',1,'unitPriceMinor',100));
 sale_result:=public.complete_warehouse_sale(sale,repeat('a',64),'cash',sale_lines,'fixture.myshopify.com',actor,null,'Synthetic');
 assert (select quantity=8 from public.inventory where id=inv);
 assert (select count(*)=1 from public.warehouse_sale_lines where product_id=p and sku is null);
 perform public.complete_warehouse_sale(sale,repeat('a',64),'cash',sale_lines,'fixture.myshopify.com',actor,null,'Synthetic');
 assert (select quantity=8 from public.inventory where id=inv),'Sale replay is UUID/idempotency based';
 assert (select count(*)=1 from public.warehouse_sale_shopify_sync_jobs where status='pending');
end $$;
rollback;
\echo 'Viper and Lagersalg optional-SKU compatibility passed and rolled back.'
