\set ON_ERROR_STOP on
set role postgres;

do $$
declare
  imported_order_id uuid;
begin
  select id into imported_order_id from public.orders
  where source = 'shopify' and external_order_id = 'gid://shopify/Order/9010';
  assert imported_order_id is not null;
  assert (select count(*) from public.orders
          where source = 'shopify' and external_order_id = 'gid://shopify/Order/9010') = 1;
  assert (select count(*) from public.pick_jobs where order_id = imported_order_id) = 1;
  assert (select count(*) from public.order_lines where order_id = imported_order_id) = 1;
  assert (select count(*) from public.viper_events where order_id = imported_order_id) = 2;
  assert (select count(*) from public.activity_log
          where entity_id = imported_order_id and action = 'viper_order_imported') = 1;
end;
$$;

drop trigger viper_p4_test_delay_order on public.orders;
drop function public.viper_p4_test_delay_order();

\echo 'Viper P4.2 concurrency assertions passed'
