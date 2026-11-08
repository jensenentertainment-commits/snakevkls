\ir viper-acceptance.guard.sql
-- Only the synthetic seed is eligible for teardown. Failure leaves evidence intact.
do $$ begin
 if (select count(*) from public.orders)<>1 or not exists(select 1 from public.orders where external_order_id='gid://shopify/Order/82001')
  or (select count(*) from public.products)<>1 or not exists(select 1 from public.products where id='84000000-0000-4000-8000-000000000001')
 then raise exception 'Unexpected cleanup population'; end if;
end $$;
delete from private.viper_commands where pick_job_id in(select id from public.pick_jobs where order_id in(select id from public.orders where external_order_id='gid://shopify/Order/82001'));
delete from public.viper_events where order_id in(select id from public.orders where external_order_id='gid://shopify/Order/82001');
delete from public.stock_movements where order_id in(select id from public.orders where external_order_id='gid://shopify/Order/82001');
delete from public.activity_log where actor_id in('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002');
delete from public.pick_exceptions where pick_job_id in(select id from public.pick_jobs where order_id in(select id from public.orders where external_order_id='gid://shopify/Order/82001'));
delete from public.pick_lines where pick_job_id in(select id from public.pick_jobs where order_id in(select id from public.orders where external_order_id='gid://shopify/Order/82001'));
delete from public.pick_jobs where order_id in(select id from public.orders where external_order_id='gid://shopify/Order/82001');
delete from public.order_lines where order_id in(select id from public.orders where external_order_id='gid://shopify/Order/82001');
delete from public.orders where external_order_id='gid://shopify/Order/82001';
delete from public.inventory where product_id='84000000-0000-4000-8000-000000000001';
delete from public.products where id='84000000-0000-4000-8000-000000000001';
delete from public.locations where zone_id='82000000-0000-4000-8000-000000000001';
delete from public.zones where id='82000000-0000-4000-8000-000000000001';
delete from public.profiles where id in('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002');
delete from auth.users where id in('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002');
