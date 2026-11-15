-- Invoked only after exact local identity guard, inside a rolled-back transaction.
create function pg_temp.check_a(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;
do $$
declare
 p uuid := gen_random_uuid(); z uuid := gen_random_uuid(); l1 uuid := gen_random_uuid(); l2 uuid := gen_random_uuid();
 inactive uuid := gen_random_uuid(); i uuid; result jsonb; stamp timestamptz; n integer; old_q integer;
begin
 insert into public.zones(id,code,name,pick_priority) values(z,'PKGA-'||z,'Synthetic package A',99999);
 insert into public.locations(id,code,zone_id,active,pick_sequence) values(l1,'PKGA-'||l1,z,true,1),(l2,'PKGA-'||l2,z,true,2),(inactive,'PKGA-'||inactive,z,false,3);
 insert into public.products(id,product_name,sku) values(p,'Synthetic package A',null);
 result := public.save_product_placement_v2('register',p,null,l1,null,null,null,null,10,null,null,null);
 i := (result->>'inventoryId')::uuid;
 perform pg_temp.check_a((select quantity=10 and location_id=l1 and zone_id=z from public.inventory where id=i),'register without SKU');
 select count(*) into n from public.stock_movements where inventory_id=i;
 perform pg_temp.check_a(n=1,'registration logged once');
 begin
   perform public.save_product_placement_v2('register',p,null,l1,null,null,null,null,10,null,null,null);
   raise exception 'duplicate registration accepted';
 exception when serialization_failure then null; end;
 perform pg_temp.check_a((select count(*)=1 from public.inventory where product_id=p),'stale registration rejected');

 -- Simulate stock changed after the UI opened. A pure move must preserve 7.
 update public.inventory set quantity=7,updated_at=clock_timestamp() where id=i;
 perform public.save_product_placement_v2('place',p,i,l2,l1,z,null,null,null,null,null,null);
 perform pg_temp.check_a((select quantity=7 and id=i and location_id=l2 from public.inventory where id=i),'move preserves newer quantity and UUID');
 perform pg_temp.check_a((select count(*)=n from public.stock_movements where inventory_id=i),'move creates no quantity movement');
 begin
   perform public.save_product_placement_v2('place',p,i,l1,l1,z,null,null,null,null,null,null);
   raise exception 'stale placement accepted';
 exception when serialization_failure then null; end;
 perform pg_temp.check_a((select location_id=l2 from public.inventory where id=i),'stale placement rejected');
 begin
   perform public.save_product_placement_v2('place',p,i,l1,l2,z,null,null,99,null,null,null);
   raise exception 'quantity accepted in move';
 exception when invalid_parameter_value then null; end;
 perform pg_temp.check_a((select quantity=7 from public.inventory where id=i),'quantity injection rejected');

 select updated_at into stamp from public.inventory where id=i;
 begin
   perform public.save_product_placement_v2('quantity',p,i,l2,l2,z,10,stamp,12,null,null,null);
   raise exception 'stale quantity accepted';
 exception when serialization_failure then null; end;
 perform pg_temp.check_a((select quantity=7 from public.inventory where id=i),'stale quantity rejected');
 perform public.save_product_placement_v2('quantity',p,i,l2,l2,z,7,stamp,12,null,null,null);
 perform pg_temp.check_a((select quantity=12 from public.inventory where id=i),'explicit quantity correction');
 perform pg_temp.check_a((select sum(quantity_delta)=15 from public.stock_movements where inventory_id=i),'explicit delta logged, external simulated change excluded');
 begin
   perform public.save_product_placement_v2('quantity',p,i,l2,l2,z,7,stamp,12,null,null,null);
   raise exception 'duplicate correction accepted';
 exception when serialization_failure then null; end;
 perform pg_temp.check_a((select quantity=12 from public.inventory where id=i),'correction replay does not repeat stock change');
 begin
   perform public.save_product_placement_v2('place',p,i,inactive,l2,z,null,null,null,null,null,null);
   raise exception 'inactive accepted';
 exception when invalid_parameter_value then null; end;
 perform pg_temp.check_a((select location_id=l2 from public.inventory where id=i),'inactive location rejected');

 insert into public.inventory(product_id,location_id,zone_id,quantity,is_primary) values(p,l1,z,3,false);
 begin
   perform public.save_product_placement_v2('place',p,i,l1,l2,z,null,null,null,null,null,null);
   raise exception 'collision accepted';
 exception when unique_violation then null; end;
 perform pg_temp.check_a((select count(*)=2 and sum(quantity)=15 from public.inventory where product_id=p),'collision preserves both UUIDs and quantities');
 begin
   perform public.set_product_location(p,i,z,l1,999,null,null,null);
   raise exception 'legacy RPC accepted';
 exception when feature_not_supported then null; end;
 perform pg_temp.check_a((select quantity=12 from public.inventory where id=i),'legacy RPC fails closed even for owner');
 perform pg_temp.check_a(not has_function_privilege('service_role','public.set_product_location(uuid,uuid,uuid,uuid,integer,uuid,text,text)','EXECUTE'),'legacy service_role execution revoked');
 perform pg_temp.check_a(has_function_privilege('service_role','public.save_product_placement_v2(text,uuid,uuid,uuid,uuid,uuid,integer,timestamptz,integer,uuid,text,text)','EXECUTE')
   and not has_function_privilege('authenticated','public.save_product_placement_v2(text,uuid,uuid,uuid,uuid,uuid,integer,timestamptz,integer,uuid,text,text)','EXECUTE')
   and not has_function_privilege('anon','public.save_product_placement_v2(text,uuid,uuid,uuid,uuid,uuid,integer,timestamptz,integer,uuid,text,text)','EXECUTE'),'new RPC service-only');
 select quantity into old_q from public.inventory where id=i;
 begin
   select updated_at into stamp from public.inventory where id=i;
   perform public.save_product_placement_v2('quantity',p,i,l2,l2,z,old_q,stamp,2,null,null,null);
   raise exception 'synthetic rollback' using errcode='P0002';
 exception when no_data_found then null; end;
 perform pg_temp.check_a((select quantity=old_q from public.inventory where id=i),'rollback restores quantity');
 perform pg_temp.check_a((select count(*)=n+1 from public.stock_movements where inventory_id=i),'rollback restores movement history');
end; $$;
