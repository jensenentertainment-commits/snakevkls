\ir roy-phase-2a-acceptance.guard.sql
begin;
-- scenario is a runner-owned literal, never operator SQL.
select set_config('snake.catalog_scenario', :'scenario', true);
do $$ begin
 case current_setting('snake.catalog_scenario')
 when 'inventory' then update public.inventory set quantity=4 where id='98800000-0000-4000-8000-000000000004';
 when 'inventory_insert' then insert into public.inventory(product_id,quantity,is_primary) values('98800000-0000-4000-8000-000000000001',4,false);
 when 'order' then update public.orders set status='received' where id='98800000-0000-4000-8000-000000000005';
 when 'order_insert' then
   insert into public.orders(id,source,external_order_id,order_number,status) values('98800000-0000-4000-8000-000000000008','manual','CC-NEW','#CC-NEW','received');
   insert into public.order_lines(order_id,external_line_id,product_id,product_name,requested_quantity) values('98800000-0000-4000-8000-000000000008','CC-NEW-L','98800000-0000-4000-8000-000000000001','Synthetic',1);
 when 'pick' then update public.pick_jobs set status='ready' where id='98800000-0000-4000-8000-000000000007';
 when 'product_share' then perform 1 from public.products where id='98800000-0000-4000-8000-000000000001' for share;
 else raise exception 'Unknown concurrency scenario'; end case;
 perform pg_advisory_xact_lock(992,1);
 perform phase2a_test.wait_catalog_barrier(2,true);
end $$;
rollback;
