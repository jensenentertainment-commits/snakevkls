-- Phase 2: resumable, single-worker Shopify product sync.
-- Sync state is private and can only be mutated through service-role RPCs.

create table private.sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'paused', 'failed', 'completed')),
  source text not null check (source in ('manual', 'cron')),
  actor_email text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  cursor text,
  has_next_page boolean not null default true,
  processed_count integer not null default 0 check (processed_count >= 0),
  skipped_no_sku integer not null default 0 check (skipped_no_sku >= 0),
  collections_linked integer not null default 0
    check (collections_linked >= 0),
  pages_processed integer not null default 0 check (pages_processed >= 0),
  reconciled_count integer not null default 0 check (reconciled_count >= 0),
  error_message text,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz not null default now()
);

create unique index sync_runs_one_resumable_idx
  on private.sync_runs ((true))
  where status in ('running', 'paused', 'failed');

create table private.sync_run_variants (
  run_id uuid not null references private.sync_runs(id) on delete cascade,
  shopify_variant_id text not null,
  primary key (run_id, shopify_variant_id)
);

revoke all on table private.sync_runs, private.sync_run_variants
  from public, anon, authenticated;

-- Shopify variant IDs are stable technical identities. PostgreSQL unique
-- constraints still permit multiple NULL values for local-only products.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_shopify_variant_id_key'
  ) then
    alter table public.products
      add constraint products_shopify_variant_id_key
      unique (shopify_variant_id);
  end if;
end;
$$;

create or replace function public.claim_shopify_sync_run(
  requested_source text,
  requested_actor_email text default null,
  requested_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_run private.sync_runs%rowtype;
  new_lease_token uuid := gen_random_uuid();
  was_resumed boolean := false;
begin
  if requested_source not in ('manual', 'cron') then
    raise exception 'Invalid Shopify sync source';
  end if;

  if requested_lease_seconds < 30 or requested_lease_seconds > 300 then
    raise exception 'Invalid Shopify sync lease duration';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('snake_shopify_sync', 0));

  select * into current_run
  from private.sync_runs
  where status = 'running'
  order by started_at desc
  limit 1
  for update;

  if found and current_run.lease_expires_at > now() then
    return jsonb_build_object(
      'acquired', false,
      'runId', current_run.id,
      'status', current_run.status,
      'source', current_run.source,
      'cursor', current_run.cursor,
      'processedCount', current_run.processed_count,
      'pagesProcessed', current_run.pages_processed,
      'errorMessage', current_run.error_message,
      'leaseExpiresAt', current_run.lease_expires_at
    );
  end if;

  if found then
    was_resumed := true;

    update private.sync_runs
    set lease_token = new_lease_token,
        lease_expires_at = now() + make_interval(secs => requested_lease_seconds),
        last_heartbeat_at = now(),
        error_message = case
          when current_run.lease_token is not null then
            'Forrige worker ble avbrutt eller overskred lease; kjøringen fortsetter.'
          else current_run.error_message
        end
    where id = current_run.id
    returning * into current_run;
  else
    select * into current_run
    from private.sync_runs
    where status in ('paused', 'failed')
      and completed_at is null
    order by started_at desc
    limit 1
    for update;

    if found then
      was_resumed := true;

      update private.sync_runs
      set status = 'running',
          source = requested_source,
          actor_email = coalesce(requested_actor_email, actor_email),
          lease_token = new_lease_token,
          lease_expires_at = now() + make_interval(secs => requested_lease_seconds),
          last_heartbeat_at = now()
      where id = current_run.id
      returning * into current_run;
    else
      insert into private.sync_runs (
        source,
        actor_email,
        lease_token,
        lease_expires_at
      ) values (
        requested_source,
        requested_actor_email,
        new_lease_token,
        now() + make_interval(secs => requested_lease_seconds)
      )
      returning * into current_run;
    end if;
  end if;

  return jsonb_build_object(
    'acquired', true,
    'resumed', was_resumed,
    'runId', current_run.id,
    'status', current_run.status,
    'source', current_run.source,
    'cursor', current_run.cursor,
    'processedCount', current_run.processed_count,
    'pagesProcessed', current_run.pages_processed,
    'errorMessage', current_run.error_message,
    'leaseToken', new_lease_token,
    'leaseExpiresAt', current_run.lease_expires_at
  );
end;
$$;

create or replace function public.apply_shopify_sync_page(
  requested_run_id uuid,
  requested_lease_token uuid,
  expected_cursor text,
  next_cursor text,
  page_has_next boolean,
  page_variants jsonb,
  page_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_run private.sync_runs%rowtype;
  variant jsonb;
  collection jsonb;
  local_product_id uuid;
  variant_id text;
  variant_sku text;
  page_processed integer := 0;
  page_skipped integer := 0;
  page_collections integer := 0;
begin
  if jsonb_typeof(page_variants) <> 'array' then
    raise exception 'Shopify page payload must be an array';
  end if;

  select * into current_run
  from private.sync_runs
  where id = requested_run_id
  for update;

  if not found
    or current_run.status <> 'running'
    or current_run.lease_token is distinct from requested_lease_token
    or current_run.lease_expires_at <= now()
  then
    raise exception 'Shopify sync lease is not valid';
  end if;

  if current_run.cursor is distinct from expected_cursor then
    raise exception 'Shopify sync cursor conflict';
  end if;

  for variant in select value from jsonb_array_elements(page_variants)
  loop
    variant_id := nullif(variant ->> 'shopifyVariantId', '');
    variant_sku := nullif(btrim(variant ->> 'sku'), '');
    local_product_id := null;

    if variant_id is null then
      raise exception 'Shopify variant is missing its technical ID';
    end if;

    insert into private.sync_run_variants (run_id, shopify_variant_id)
    values (requested_run_id, variant_id)
    on conflict do nothing;

    select id into local_product_id
    from public.products
    where shopify_variant_id = variant_id;

    if local_product_id is null and variant_sku is not null then
      select id into local_product_id
      from public.products
      where sku = variant_sku;
    end if;

    if local_product_id is null and variant_sku is null then
      page_skipped := page_skipped + 1;
      continue;
    end if;

    if local_product_id is null then
      insert into public.products (
        sku,
        product_name,
        variant_name,
        active,
        image_url,
        vendor,
        product_type,
        shopify_quantity,
        shopify_product_id,
        shopify_variant_id,
        shopify_inventory_item_id,
        shopify_status,
        synced_at
      ) values (
        variant_sku,
        variant ->> 'productName',
        nullif(variant ->> 'variantName', ''),
        true,
        nullif(variant ->> 'imageUrl', ''),
        nullif(variant ->> 'vendor', ''),
        nullif(variant ->> 'productType', ''),
        coalesce((variant ->> 'shopifyQuantity')::integer, 0),
        variant ->> 'shopifyProductId',
        variant_id,
        nullif(variant ->> 'shopifyInventoryItemId', ''),
        variant ->> 'shopifyStatus',
        now()
      )
      returning id into local_product_id;
    else
      update public.products
      set sku = coalesce(variant_sku, sku),
          product_name = variant ->> 'productName',
          variant_name = nullif(variant ->> 'variantName', ''),
          active = true,
          image_url = nullif(variant ->> 'imageUrl', ''),
          vendor = nullif(variant ->> 'vendor', ''),
          product_type = nullif(variant ->> 'productType', ''),
          shopify_quantity = coalesce((variant ->> 'shopifyQuantity')::integer, 0),
          shopify_product_id = variant ->> 'shopifyProductId',
          shopify_variant_id = variant_id,
          shopify_inventory_item_id = nullif(variant ->> 'shopifyInventoryItemId', ''),
          shopify_status = variant ->> 'shopifyStatus',
          synced_at = now()
      where id = local_product_id;
    end if;

    delete from public.product_collections
    where product_id = local_product_id;

    for collection in
      select value
      from jsonb_array_elements(coalesce(variant -> 'collections', '[]'::jsonb))
    loop
      insert into public.product_collections (
        product_id,
        shopify_collection_id,
        title,
        handle
      ) values (
        local_product_id,
        collection ->> 'id',
        collection ->> 'title',
        nullif(collection ->> 'handle', '')
      )
      on conflict (product_id, shopify_collection_id)
      do update set
        title = excluded.title,
        handle = excluded.handle;

      page_collections := page_collections + 1;
    end loop;

    page_processed := page_processed + 1;
  end loop;

  update private.sync_runs
  set cursor = next_cursor,
      has_next_page = page_has_next,
      processed_count = processed_count + page_processed,
      skipped_no_sku = skipped_no_sku + page_skipped,
      collections_linked = collections_linked + page_collections,
      pages_processed = pages_processed + 1,
      lease_expires_at = now() + make_interval(secs => page_lease_seconds),
      last_heartbeat_at = now(),
      error_message = null
  where id = requested_run_id
  returning * into current_run;

  return jsonb_build_object(
    'runId', current_run.id,
    'status', current_run.status,
    'cursor', current_run.cursor,
    'hasNextPage', current_run.has_next_page,
    'processedCount', current_run.processed_count,
    'skippedNoSku', current_run.skipped_no_sku,
    'collectionsLinked', current_run.collections_linked,
    'pagesProcessed', current_run.pages_processed,
    'leaseExpiresAt', current_run.lease_expires_at
  );
end;
$$;

create or replace function public.complete_shopify_sync_run(
  requested_run_id uuid,
  requested_lease_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_run private.sync_runs%rowtype;
  reconciled integer := 0;
begin
  select * into current_run
  from private.sync_runs
  where id = requested_run_id
  for update;

  if not found
    or current_run.status <> 'running'
    or current_run.lease_token is distinct from requested_lease_token
    or current_run.lease_expires_at <= now()
  then
    raise exception 'Shopify sync lease is not valid';
  end if;

  if current_run.has_next_page then
    raise exception 'Shopify sync cannot complete before the final page';
  end if;

  update public.products as product
  set active = false,
      shopify_status = 'NOT_ACTIVE',
      synced_at = now()
  where product.shopify_variant_id is not null
    and not exists (
      select 1
      from private.sync_run_variants as seen
      where seen.run_id = requested_run_id
        and seen.shopify_variant_id = product.shopify_variant_id
    );

  get diagnostics reconciled = row_count;

  update private.sync_runs
  set status = 'completed',
      completed_at = now(),
      reconciled_count = reconciled,
      lease_token = null,
      lease_expires_at = null,
      last_heartbeat_at = now(),
      error_message = null
  where id = requested_run_id
  returning * into current_run;

  return jsonb_build_object(
    'runId', current_run.id,
    'status', current_run.status,
    'startedAt', current_run.started_at,
    'completedAt', current_run.completed_at,
    'processedCount', current_run.processed_count,
    'skippedNoSku', current_run.skipped_no_sku,
    'collectionsLinked', current_run.collections_linked,
    'pagesProcessed', current_run.pages_processed,
    'reconciledCount', current_run.reconciled_count
  );
end;
$$;

create or replace function public.fail_shopify_sync_run(
  requested_run_id uuid,
  requested_lease_token uuid,
  requested_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_run private.sync_runs%rowtype;
begin
  update private.sync_runs
  set status = 'failed',
      error_message = left(coalesce(requested_error_message, 'Ukjent feil'), 2000),
      lease_token = null,
      lease_expires_at = null,
      last_heartbeat_at = now()
  where id = requested_run_id
    and status = 'running'
    and lease_token = requested_lease_token
  returning * into current_run;

  if not found then
    raise exception 'Shopify sync lease is not valid';
  end if;

  return jsonb_build_object(
    'runId', current_run.id,
    'status', current_run.status,
    'cursor', current_run.cursor,
    'processedCount', current_run.processed_count,
    'pagesProcessed', current_run.pages_processed,
    'errorMessage', current_run.error_message
  );
end;
$$;

create or replace function public.pause_shopify_sync_run(
  requested_run_id uuid,
  requested_lease_token uuid,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_run private.sync_runs%rowtype;
begin
  update private.sync_runs
  set status = 'paused',
      error_message = left(coalesce(requested_reason, 'Kontrollert pause'), 2000),
      lease_token = null,
      lease_expires_at = null,
      last_heartbeat_at = now()
  where id = requested_run_id
    and status = 'running'
    and lease_token = requested_lease_token
  returning * into current_run;

  if not found then
    raise exception 'Shopify sync lease is not valid';
  end if;

  return jsonb_build_object(
    'runId', current_run.id,
    'status', current_run.status,
    'cursor', current_run.cursor,
    'processedCount', current_run.processed_count,
    'pagesProcessed', current_run.pages_processed,
    'errorMessage', current_run.error_message
  );
end;
$$;

create or replace function public.get_shopify_sync_run(
  requested_run_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'runId', run.id,
        'status', run.status,
        'source', run.source,
        'startedAt', run.started_at,
        'completedAt', run.completed_at,
        'cursor', run.cursor,
        'hasNextPage', run.has_next_page,
        'processedCount', run.processed_count,
        'skippedNoSku', run.skipped_no_sku,
        'collectionsLinked', run.collections_linked,
        'pagesProcessed', run.pages_processed,
        'reconciledCount', run.reconciled_count,
        'errorMessage', run.error_message,
        'leaseExpiresAt', run.lease_expires_at,
        'lastHeartbeatAt', run.last_heartbeat_at
      )
      from private.sync_runs as run
      where requested_run_id is null or run.id = requested_run_id
      order by run.started_at desc
      limit 1
    ),
    '{}'::jsonb
  );
$$;

revoke all on function public.claim_shopify_sync_run(text, text, integer)
  from public, anon, authenticated;
revoke all on function public.apply_shopify_sync_page(
  uuid, uuid, text, text, boolean, jsonb, integer
) from public, anon, authenticated;
revoke all on function public.complete_shopify_sync_run(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.fail_shopify_sync_run(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.pause_shopify_sync_run(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_shopify_sync_run(uuid)
  from public, anon, authenticated;

grant execute on function public.claim_shopify_sync_run(text, text, integer)
  to service_role;
grant execute on function public.apply_shopify_sync_page(
  uuid, uuid, text, text, boolean, jsonb, integer
) to service_role;
grant execute on function public.complete_shopify_sync_run(uuid, uuid)
  to service_role;
grant execute on function public.fail_shopify_sync_run(uuid, uuid, text)
  to service_role;
grant execute on function public.pause_shopify_sync_run(uuid, uuid, text)
  to service_role;
grant execute on function public.get_shopify_sync_run(uuid)
  to service_role;
