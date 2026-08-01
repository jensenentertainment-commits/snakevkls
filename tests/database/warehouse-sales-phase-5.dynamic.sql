\set ON_ERROR_STOP on

set role postgres;

-- Incoming observation before the outbound mutation: Shopify still contains
-- the quantities from before the local sale.
update public.products
set shopify_quantity = case id
      when '50000000-0000-4000-8000-000000000001' then 6
      when '50000000-0000-4000-8000-000000000002' then 5
    end,
    shopify_inventory_observed_at = now()
where id in (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002'
);

do $$
declare
  claim jsonb;
begin
  assert (select reconciliation_status = 'outbound_in_flight'
          and raw_difference = 5
          and explained_difference = 0
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000001');

  -- A repeated incoming observation before Shopify mutation remains explained.
  update public.products
  set shopify_quantity = 6,
      shopify_inventory_observed_at = now()
  where id = '50000000-0000-4000-8000-000000000001';

  assert (select reconciliation_status = 'outbound_in_flight'
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000001');

  claim := public.claim_warehouse_sale_shopify_sync_job(60);
  perform public.complete_warehouse_sale_shopify_sync_job(
    (claim ->> 'jobId')::uuid,
    (claim ->> 'leaseToken')::uuid,
    (claim ->> 'referenceDocumentUri') || '#synthetic-confirmation'
  );

  -- The successful mutation is newer than the observation. The old observation
  -- is still explained until an incoming sync observes the post-mutation value.
  assert (select reconciliation_status = 'outbound_in_flight'
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000001');

  perform pg_sleep(0.01);
  update public.products
  set shopify_quantity = case id
        when '50000000-0000-4000-8000-000000000001' then 1
        when '50000000-0000-4000-8000-000000000002' then 3
      end,
      shopify_inventory_observed_at = clock_timestamp()
  where id in (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002'
  );

  assert (select reconciliation_status = 'in_sync'
          and raw_difference = 0
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000001');

  -- A later location-specific observation that does not match Snake and cannot
  -- be explained by an unobserved outbound delta is a real discrepancy.
  update public.products
  set shopify_quantity = 2,
      shopify_inventory_observed_at = clock_timestamp()
  where id = '50000000-0000-4000-8000-000000000001';

  assert (select reconciliation_status = 'unexplained_difference'
          and raw_difference = 1
          and explained_difference = 1
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000001');
end;
$$;

\echo 'phase5 incoming/outgoing ordering assertions passed'
