\set ON_ERROR_STOP on

set role service_role;

do $$
declare
  first_claim jsonb;
  blocked_claim jsonb;
  retry_claim jsonb;
  original_payload jsonb;
  original_hash text;
  original_location text;
  original_idempotency uuid;
  original_reference text;
  job_id uuid;
begin
  first_claim := public.claim_warehouse_sale_shopify_sync_job(60);
  assert (first_claim ->> 'acquired')::boolean;
  job_id := (first_claim ->> 'jobId')::uuid;

  select payload, payload_hash, shopify_location_id, idempotency_key,
         reference_document_uri
  into original_payload, original_hash, original_location,
       original_idempotency, original_reference
  from public.warehouse_sale_shopify_sync_jobs
  where id = job_id;

  blocked_claim := public.claim_warehouse_sale_shopify_sync_job(60);
  assert not (blocked_claim ->> 'acquired')::boolean;

  perform public.fail_warehouse_sale_shopify_sync_job(
    job_id,
    (first_claim ->> 'leaseToken')::uuid,
    'TIMEOUT_UNKNOWN',
    'Synthetic timeout with unknown result',
    30
  );
  assert (select status = 'failed' and next_attempt_at > now()
          from public.warehouse_sale_shopify_sync_jobs where id = job_id);

  blocked_claim := public.claim_warehouse_sale_shopify_sync_job(60);
  assert not (blocked_claim ->> 'acquired')::boolean;

  perform public.retry_warehouse_sale_shopify_sync_job(job_id);
  retry_claim := public.claim_warehouse_sale_shopify_sync_job(60);
  assert (retry_claim ->> 'acquired')::boolean;
  assert retry_claim ->> 'leaseToken' <> first_claim ->> 'leaseToken';
  assert retry_claim ->> 'idempotencyKey' = original_idempotency::text;
  assert retry_claim -> 'payload' = original_payload;
  assert retry_claim ->> 'payloadHash' = original_hash;
  assert retry_claim ->> 'shopifyLocationId' = original_location;
  assert retry_claim ->> 'referenceDocumentUri' = original_reference;

  begin
    perform public.complete_warehouse_sale_shopify_sync_job(
      job_id,
      (first_claim ->> 'leaseToken')::uuid,
      'stale-worker'
    );
    assert false, 'stale lease must be rejected';
  exception when others then
    assert sqlerrm = 'Warehouse sale Shopify lease is not valid';
  end;

  perform public.complete_warehouse_sale_shopify_sync_job(
    job_id,
    (retry_claim ->> 'leaseToken')::uuid,
    original_reference || '#2026-07-29T20:00:00Z'
  );

  assert (select status = 'synced'
                 and attempt_count = 2
                 and lease_token is null
                 and synced_at is not null
          from public.warehouse_sale_shopify_sync_jobs where id = job_id);
  assert (select payload = original_payload
                 and payload_hash = original_hash
                 and shopify_location_id = original_location
                 and idempotency_key = original_idempotency
                 and reference_document_uri = original_reference
          from public.warehouse_sale_shopify_sync_jobs where id = job_id);
end;
$$;

\echo 'phase4 dynamic lease and retry assertions passed'
