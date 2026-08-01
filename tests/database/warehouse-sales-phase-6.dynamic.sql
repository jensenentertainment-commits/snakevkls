\set ON_ERROR_STOP on

set role postgres;

-- Observations from before the local two-line sale.
update public.products
set shopify_quantity = case id
      when '50000000-0000-4000-8000-000000000001' then 6
      when '50000000-0000-4000-8000-000000000002' then 4
    end,
    shopify_inventory_observed_at = now()
where id in (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002'
);

do $$
declare
  first_claim jsonb;
  reclaimed jsonb;
  manual_retry_claim jsonb;
  job_id uuid;
begin
  -- Product A is fully explained by the pending local sale.
  assert (select reconciliation_status = 'outbound_in_flight'
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000001');

  -- Product B includes a synthetic Shopify web order between local commit and
  -- outbound mutation. The outbox delta cannot explain that extra reduction.
  assert (select reconciliation_status = 'unexplained_difference'
          and explained_difference = -1
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000002');

  set local role service_role;
  first_claim := public.claim_warehouse_sale_shopify_sync_job(60);
  job_id := (first_claim ->> 'jobId')::uuid;

  set local role postgres;
  update public.warehouse_sale_shopify_sync_jobs
  set lease_expires_at = clock_timestamp() - interval '1 second'
  where id = job_id;

  set local role service_role;
  reclaimed := public.claim_warehouse_sale_shopify_sync_job(60);
  assert (reclaimed ->> 'jobId')::uuid = job_id;
  assert reclaimed ->> 'leaseToken' <> first_claim ->> 'leaseToken';
  assert reclaimed ->> 'idempotencyKey' = first_claim ->> 'idempotencyKey';
  assert reclaimed -> 'payload' = first_claim -> 'payload';

  begin
    perform public.complete_warehouse_sale_shopify_sync_job(
      job_id,
      (first_claim ->> 'leaseToken')::uuid,
      'stale'
    );
    assert false, 'stale worker result must fail';
  exception when others then
    assert sqlerrm = 'Warehouse sale Shopify lease is not valid';
  end;

  perform public.fail_warehouse_sale_shopify_sync_job(
    job_id,
    (reclaimed ->> 'leaseToken')::uuid,
    'INVALID_LOCATION',
    'Synthetic permanent failure',
    null
  );

  assert (select status = 'failed' and next_attempt_at is null
          from public.warehouse_sale_shopify_sync_jobs where id = job_id);
  assert (select reconciliation_status = 'outbound_failed'
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000001');

  perform public.retry_warehouse_sale_shopify_sync_job(job_id);
  manual_retry_claim := public.claim_warehouse_sale_shopify_sync_job(60);
  assert manual_retry_claim ->> 'idempotencyKey'
    = first_claim ->> 'idempotencyKey';
  assert manual_retry_claim -> 'payload' = first_claim -> 'payload';

  perform public.complete_warehouse_sale_shopify_sync_job(
    job_id,
    (manual_retry_claim ->> 'leaseToken')::uuid,
    (manual_retry_claim ->> 'referenceDocumentUri') || '#phase6'
  );

  set local role postgres;
  perform pg_sleep(0.01);
  update public.products
  set shopify_quantity = case id
        when '50000000-0000-4000-8000-000000000001' then 1
        when '50000000-0000-4000-8000-000000000002' then 2
      end,
      shopify_inventory_observed_at = clock_timestamp()
  where id in (
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002'
  );

  assert (select reconciliation_status = 'in_sync'
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000001');
  assert (select reconciliation_status = 'unexplained_difference'
          and raw_difference = -1
          from public.warehouse_sale_shopify_reconciliation
          where product_id = '50000000-0000-4000-8000-000000000002');

  -- The completed sale remains immutable and local physical quantities were
  -- not touched by any worker or incoming-observation transition.
  assert (select count(*) = 1 from public.warehouse_sales);
  assert (select count(*) = 1
          from public.warehouse_sale_shopify_sync_jobs
          where warehouse_sale_id = (
            select id from public.warehouse_sales limit 1
          ));
  assert (select quantity = 1 from public.inventory
          where product_id = '50000000-0000-4000-8000-000000000001'
            and not is_primary);
  assert (select quantity = 3 from public.inventory
          where product_id = '50000000-0000-4000-8000-000000000002');
end;
$$;

\echo 'phase6 cross-phase dynamic assertions passed'

