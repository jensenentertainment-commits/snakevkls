-- Warehouse sales Phase 4: transactional claim, lease and retry transitions.
-- Payload identity is protected by the immutable trigger from Phase 2.

create or replace function public.claim_warehouse_sale_shopify_sync_job(
  requested_lease_seconds integer default 60
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed public.warehouse_sale_shopify_sync_jobs%rowtype;
  new_lease_token uuid := gen_random_uuid();
begin
  if requested_lease_seconds < 15 or requested_lease_seconds > 300 then
    raise exception 'Warehouse sale Shopify lease duration is invalid';
  end if;

  select job.* into claimed
  from public.warehouse_sale_shopify_sync_jobs as job
  where
    (job.status = 'pending'
      and coalesce(job.next_attempt_at, '-infinity'::timestamptz) <= now())
    or
    (job.status = 'failed'
      and job.next_attempt_at is not null
      and job.next_attempt_at <= now())
    or
    (job.status = 'processing' and job.lease_expires_at <= now())
  order by coalesce(job.next_attempt_at, job.created_at), job.created_at, job.id
  limit 1
  for update skip locked;

  if not found then
    return jsonb_build_object('acquired', false);
  end if;

  update public.warehouse_sale_shopify_sync_jobs
  set status = 'processing',
      attempt_count = attempt_count + 1,
      lease_token = new_lease_token,
      lease_expires_at =
        now() + make_interval(secs => requested_lease_seconds),
      last_attempt_at = now(),
      next_attempt_at = null,
      updated_at = now()
  where id = claimed.id
  returning * into claimed;

  return jsonb_build_object(
    'acquired', true,
    'jobId', claimed.id,
    'warehouseSaleId', claimed.warehouse_sale_id,
    'shop', claimed.shop,
    'shopifyLocationId', claimed.shopify_location_id,
    'idempotencyKey', claimed.idempotency_key,
    'referenceDocumentUri', claimed.reference_document_uri,
    'payload', claimed.payload,
    'payloadHash', claimed.payload_hash,
    'attemptCount', claimed.attempt_count,
    'leaseToken', claimed.lease_token,
    'leaseExpiresAt', claimed.lease_expires_at
  );
end;
$$;

create or replace function public.complete_warehouse_sale_shopify_sync_job(
  requested_job_id uuid,
  requested_lease_token uuid,
  requested_adjustment_group_id text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(btrim(requested_adjustment_group_id), '') is null then
    raise exception 'Shopify adjustment group is required';
  end if;

  update public.warehouse_sale_shopify_sync_jobs
  set status = 'synced',
      lease_token = null,
      lease_expires_at = null,
      next_attempt_at = null,
      synced_at = now(),
      shopify_adjustment_group_id = requested_adjustment_group_id,
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
  where id = requested_job_id
    and status = 'processing'
    and lease_token = requested_lease_token
    and lease_expires_at > now();

  if not found then
    raise exception 'Warehouse sale Shopify lease is not valid';
  end if;
end;
$$;

create or replace function public.fail_warehouse_sale_shopify_sync_job(
  requested_job_id uuid,
  requested_lease_token uuid,
  requested_error_code text,
  requested_error_message text,
  requested_retry_delay_seconds integer default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(btrim(requested_error_code), '') is null
    or nullif(btrim(requested_error_message), '') is null
    or (
      requested_retry_delay_seconds is not null
      and (
        requested_retry_delay_seconds < 1
        or requested_retry_delay_seconds > 86400
      )
    )
  then
    raise exception 'Warehouse sale Shopify failure is invalid';
  end if;

  update public.warehouse_sale_shopify_sync_jobs
  set status = 'failed',
      lease_token = null,
      lease_expires_at = null,
      next_attempt_at = case
        when requested_retry_delay_seconds is null then null
        else now() + make_interval(secs => requested_retry_delay_seconds)
      end,
      last_error_code = requested_error_code,
      last_error_message = left(requested_error_message, 2000),
      updated_at = now()
  where id = requested_job_id
    and status = 'processing'
    and lease_token = requested_lease_token
    and lease_expires_at > now();

  if not found then
    raise exception 'Warehouse sale Shopify lease is not valid';
  end if;
end;
$$;

create or replace function public.retry_warehouse_sale_shopify_sync_job(
  requested_job_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.warehouse_sale_shopify_sync_jobs
  set next_attempt_at = now(),
      updated_at = now()
  where id = requested_job_id
    and status = 'failed'
    and lease_token is null;

  if not found then
    raise exception 'Warehouse sale Shopify job cannot be retried';
  end if;
end;
$$;

revoke all on function
  public.claim_warehouse_sale_shopify_sync_job(integer),
  public.complete_warehouse_sale_shopify_sync_job(uuid, uuid, text),
  public.fail_warehouse_sale_shopify_sync_job(uuid, uuid, text, text, integer),
  public.retry_warehouse_sale_shopify_sync_job(uuid)
from public, anon, authenticated;

grant execute on function
  public.claim_warehouse_sale_shopify_sync_job(integer),
  public.complete_warehouse_sale_shopify_sync_job(uuid, uuid, text),
  public.fail_warehouse_sale_shopify_sync_job(uuid, uuid, text, text, integer),
  public.retry_warehouse_sale_shopify_sync_job(uuid)
to service_role;
