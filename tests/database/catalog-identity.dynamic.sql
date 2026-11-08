\ir roy-phase-2a-acceptance.guard.sql
begin;
\ir roy-phase-2a-targeted.helpers.sql

create function phase2a_test.blocked(rid uuid, token uuid, reason text) returns void
language plpgsql as $$
declare before_state jsonb:=phase2a_test.snapshot(); detail text;
begin
  begin
    perform public.complete_shopify_sync_run(rid,token);
    raise exception 'TEST expected completion rejection';
  exception when sqlstate 'P0001' then
    assert sqlerrm='SHOPIFY_DEACTIVATION_BLOCKED',sqlerrm;
    get stacked diagnostics detail=pg_exception_detail;
    assert (detail::jsonb->>'blockedCount')::integer=1;
    assert detail::jsonb#>'{examples,0,dependencies}' ? reason,detail;
  end;
  assert phase2a_test.snapshot()=before_state,'Rejected finalization must preserve products/pages/checkpoint/stock';
end $$;

do $$
declare
  claim jsonb; rid uuid; token uuid; variants jsonb; products jsonb; result jsonb;
  stable_id uuid; unlinked_id uuid; historical_id uuid; blocked_id uuid; inv uuid; loc uuid; zone uuid;
  oid uuid; jid uuid; lid uuid; exception_id uuid; fixture_sale_id uuid; outbox_id uuid;
  actor uuid:='96000000-0000-4000-8000-000000000001';
  before_stock jsonb; before_moves jsonb; state text;
begin
  assert not exists(select 1 from private.sync_runs);
  -- A same-SKU unlinked physical item must never be adopted by the writer.
  insert into public.products(sku,product_name) values('739007','Synthetic unlinked item') returning id into unlinked_id;
  insert into public.products(sku,product_name,shopify_variant_id) values('1513-11','Synthetic history','gid://shopify/ProductVariant/98901') returning id into historical_id;
  insert into public.stock_movements(product_id,quantity_delta,reason) values(historical_id,1,'receiving');
  insert into public.products(sku,product_name,shopify_variant_id) values('63104','Synthetic stocked item','gid://shopify/ProductVariant/98902') returning id into blocked_id;
  insert into public.zones(code,name,pick_priority) values('CI','Identity acceptance only',211) returning id into zone;
  insert into public.locations(code,zone_id,pick_sequence,location_purpose) values('CI01',zone,1,'PICK') returning id into loc;
  insert into public.inventory(product_id,location_id,zone_id,quantity) values(blocked_id,loc,zone,4) returning id into inv;
  select jsonb_agg(to_jsonb(i) order by id) into before_stock from public.inventory i;
  select jsonb_agg(to_jsonb(m) order by id) into before_moves from public.stock_movements m;
  claim:=public.claim_shopify_sync_run('manual',null,300); rid:=(claim->>'runId')::uuid;token:=(claim->>'leaseToken')::uuid;
  variants:=jsonb_build_array(phase2a_test.variant(98801,98801,'739007'),phase2a_test.variant(98802,98802,'739007'),phase2a_test.variant(98803,98803,null),phase2a_test.variant(98804,98804,'1513-11'));
  products:=jsonb_build_array(phase2a_test.product(98801),phase2a_test.product(98802),phase2a_test.product(98803),phase2a_test.product(98804));
  result:=public.apply_shopify_sync_page_v2(rid,token,null,0,'first',true,variants,products,300);
  assert result->>'processedCount'='4' and result->>'skippedNoSku'='0';
  assert (select shopify_variant_id='gid://shopify/ProductVariant/98901' from public.products where id=historical_id),'New variant with old SKU cannot relink historical UUID';
  assert (select id<>historical_id from public.products where shopify_variant_id='gid://shopify/ProductVariant/98804');
  assert (select count(*)=3 from public.products where sku='739007');
  assert (select shopify_variant_id is null from public.products where id=unlinked_id);
  select id into strict stable_id from public.products where shopify_variant_id='gid://shopify/ProductVariant/98801';
  assert stable_id<>unlinked_id;
  assert exists(select 1 from public.products where shopify_variant_id='gid://shopify/ProductVariant/98803' and sku is null);
  assert phase2a_test.read_target('739007')->>'status'='ambiguous';
  perform phase2a_test.reject_page(rid,token,null,0,'first',true,variants,products,'checkpoint conflict');
  -- Clearing/changing SKU retains UUID; later exact-variant pages cannot move FKs.
  variants:=jsonb_set(variants,'{0,sku}','null');
  result:=public.apply_shopify_sync_page_v2(rid,token,'first',1,'final',false,variants,products,300);
  assert (select id=stable_id and sku is null from public.products where shopify_variant_id='gid://shopify/ProductVariant/98801');
  assert (select jsonb_agg(to_jsonb(i) order by id) from public.inventory i)=before_stock;
  assert (select jsonb_agg(to_jsonb(m) order by id) from public.stock_movements m)=before_moves;
  perform phase2a_test.blocked(rid,token,'physical_stock');
  -- Synthetic dependency transitions ONLY within this rolled-back fixture.
  update public.inventory set quantity=0 where id=inv;
  insert into public.orders(source,external_order_id,order_number,status) values('manual','CI-ORDER','#CI','received') returning id into oid;
  insert into public.order_lines(order_id,external_line_id,product_id,shopify_variant_id,product_name,requested_quantity)
    values(oid,'CI-LINE',blocked_id,'gid://shopify/ProductVariant/98902','Synthetic item',1) returning id into lid;
  perform phase2a_test.blocked(rid,token,'active_order');
  foreach state in array array['ready_to_pick','picking'] loop
    update public.orders set status=state where id=oid;
    perform phase2a_test.blocked(rid,token,'active_order');
  end loop;
  update public.orders set status='picked' where id=oid;
  insert into public.pick_jobs(order_id) values(oid) returning id into jid;
  insert into public.pick_lines(pick_job_id,order_line_id,product_id,inventory_id,location_id,expected_quantity,sequence_number)
    values(jid,lid,blocked_id,inv,loc,1,1) returning id into lid;
  perform phase2a_test.blocked(rid,token,'active_pick');
  update public.pick_jobs set status='in_progress',assigned_to=actor,started_at=now() where id=jid;
  perform phase2a_test.blocked(rid,token,'active_pick');
  update public.pick_jobs set status='cancelled' where id=jid;
  insert into public.pick_exceptions(pick_job_id,pick_line_id,exception_type,reported_by)
    values(jid,lid,'item_not_found',actor) returning id into exception_id;
  perform phase2a_test.blocked(rid,token,'open_pick_exception');
  update public.pick_exceptions set status='resolved',resolved_by=actor,resolved_at=now(),resolution_note='Synthetic resolution' where id=exception_id;
  insert into public.warehouse_sales(sale_number,total_amount_minor,total_quantity,line_count,completed_at,completed_by,completed_by_name,idempotency_key,request_hash)
    values('LS-2026-99880001',10,1,1,now(),actor,'Synthetic',gen_random_uuid(),repeat('a',64)) returning id into fixture_sale_id;
  insert into public.warehouse_sale_lines(sale_id,line_number,product_id,sku,product_name,standard_unit_price_minor,unit_price_minor,quantity)
    values(fixture_sale_id,1,blocked_id,null,'Synthetic',10,10,1);
  insert into public.warehouse_sale_shopify_sync_jobs(warehouse_sale_id,shop,shopify_location_id,idempotency_key,reference_document_uri,payload,payload_hash)
    values(fixture_sale_id,'fixture.myshopify.com','gid://shopify/Location/1',gen_random_uuid(),'fixture:identity',
      '{"schemaVersion":1,"locationId":"gid://shopify/Location/1","changes":[{}]}',repeat('b',64)) returning id into outbox_id;
  perform phase2a_test.blocked(rid,token,'unfinished_sale_sync');
  update public.warehouse_sale_shopify_sync_jobs set status='processing',attempt_count=1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '1 minute',last_attempt_at=now() where id=outbox_id;
  perform phase2a_test.blocked(rid,token,'unfinished_sale_sync');
  update public.warehouse_sale_shopify_sync_jobs set status='failed',lease_token=null,lease_expires_at=null,last_error_message='Synthetic failure' where id=outbox_id;
  perform phase2a_test.blocked(rid,token,'unfinished_sale_sync');
  update public.warehouse_sale_shopify_sync_jobs set status='synced',synced_at=now(),shopify_adjustment_group_id='fixture',next_attempt_at=null,last_error_message=null where id=outbox_id;
  assert not exists(select 1 from private.catalog_deactivation_blockers_v1(rid));
  -- Failure after product UPDATE rolls back deactivations AND run completion.
  perform set_config('snake.phase2a_fault','private.sync_runs',true);
  execute 'create trigger identity_final_fault before update on private.sync_runs for each row execute function phase2a_test.inject_fault()';
  perform phase2a_test.reject_page(rid,token,'final',2,'invalid',false,variants,products,'checkpoint conflict');
  begin
    perform public.complete_shopify_sync_run(rid,token);
    raise exception 'TEST missing injected failure';
  exception when raise_exception then assert sqlerrm like '%fixture injected failure%',sqlerrm; end;
  assert (select active from public.products where id=historical_id);
  assert (select active from public.products where id=blocked_id);
  perform set_config('snake.phase2a_fault','',true);
  perform public.fail_shopify_sync_run(rid,token,'Synthetic recoverable completion failure');
  claim:=public.claim_shopify_sync_run('manual',null,300); token:=(claim->>'leaseToken')::uuid;
  assert claim->>'runId'=rid::text and claim->>'pagesProcessed'='2' and claim->>'hasNextPage'='false';
  perform public.complete_shopify_sync_run(rid,token);
  assert (select not active from public.products where id=historical_id),'History alone does not block';
  assert (select not active from public.products where id=blocked_id),'Resolved dependencies permit deactivation';
  assert (select active and shopify_variant_id is null from public.products where id=unlinked_id);
  assert (select product_id=blocked_id and quantity=0 from public.inventory where id=inv);
  assert (select jsonb_agg(to_jsonb(m) order by id) from public.stock_movements m)=before_moves;
  assert (select product_id=blocked_id from public.warehouse_sale_lines where sale_id=fixture_sale_id);
  begin
    perform public.complete_shopify_sync_run(rid,token);
    raise exception 'TEST repeated completion should be fenced';
  exception when raise_exception then assert sqlerrm='Shopify sync lease is not valid',sqlerrm; end;
  foreach state in array array['anon','authenticated','service_role'] loop
    assert not has_function_privilege(state,'private.catalog_deactivation_blockers_v1(uuid)','EXECUTE');
    assert not has_function_privilege(state,'private.lock_catalog_reconciliation_v1()','EXECUTE');
  end loop;
end $$;
rollback;
\echo 'Catalog identity/deactivation fixture passed and rolled back.'
