\set ON_ERROR_STOP on

do $$
begin
  assert (select count(*) from public.warehouse_sales
          where idempotency_key =
            '60000000-0000-4000-8000-000000000010') = 1;
  assert (select quantity from public.inventory
          where product_id =
            '50000000-0000-4000-8000-000000000006') = 9;
  assert (select count(*) from public.warehouse_sale_shopify_sync_jobs
          where warehouse_sale_id in (
            select id from public.warehouse_sales
            where idempotency_key =
              '60000000-0000-4000-8000-000000000010'
          )) = 1;

  assert (select count(*) from public.warehouse_sales
          where idempotency_key in (
            '60000000-0000-4000-8000-000000000011',
            '60000000-0000-4000-8000-000000000012'
          )) = 1;
  assert (select quantity from public.inventory
          where product_id =
            '50000000-0000-4000-8000-000000000007') = 1;

  assert (select count(*) from public.warehouse_sales
          where idempotency_key in (
            '60000000-0000-4000-8000-000000000013',
            '60000000-0000-4000-8000-000000000014'
          )) = 2;
  assert (select quantity from public.inventory
          where product_id =
            '50000000-0000-4000-8000-000000000008') = 6;
  assert (select quantity from public.inventory
          where product_id =
            '50000000-0000-4000-8000-000000000009') = 6;
  assert (select count(*) from public.warehouse_sale_shopify_sync_jobs
          where warehouse_sale_id in (
            select id from public.warehouse_sales
            where idempotency_key in (
              '60000000-0000-4000-8000-000000000013',
              '60000000-0000-4000-8000-000000000014'
            )
          )) = 2;
end;
$$;

drop trigger phase3_test_delay_sale on public.warehouse_sales;
drop function public.phase3_test_delay_sale();

\echo 'phase3 concurrency dynamic assertions passed'
