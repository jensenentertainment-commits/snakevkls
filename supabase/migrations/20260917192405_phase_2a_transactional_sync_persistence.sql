-- Roy Phase 2A Commit 5. Forward-only; no backfill or checkpoint reset.
-- Handles are lookup values in historical observations, never product identity.
drop index public.shopify_product_content_handle_key;
create index shopify_product_content_handle_idx
  on public.shopify_product_content (product_handle)
  where product_handle is not null;

create function public.apply_shopify_sync_page_v2(
  requested_run_id uuid,
  requested_lease_token uuid,
  expected_cursor text,
  expected_pages_processed integer,
  next_cursor text,
  page_has_next boolean,
  page_variants jsonb,
  page_products jsonb,
  page_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_run private.sync_runs%rowtype;
  snapshot jsonb;
  content jsonb;
  observation jsonb;
  member jsonb;
  variant jsonb;
  field_name text;
  product_id text;
  product_ids text[] := array[]::text[];
  canonical_members jsonb;
  legacy_members jsonb;
  applied_page jsonb;
  timestamp_pattern constant text :=
    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$';
begin
  if jsonb_typeof(page_variants) is distinct from 'array'
    or jsonb_typeof(page_products) is distinct from 'array'
    or expected_pages_processed is null or expected_pages_processed < 0
    or page_has_next is null
    or page_lease_seconds is null or page_lease_seconds not between 30 and 300
  then
    raise exception 'Invalid Shopify page envelope';
  end if;

  select * into current_run
  from private.sync_runs
  where id = requested_run_id
  for update;

  if not found or current_run.status is distinct from 'running'
    or requested_lease_token is null
    or current_run.lease_token is distinct from requested_lease_token
    or current_run.lease_expires_at is null
    or current_run.lease_expires_at <= clock_timestamp()
  then
    raise exception 'Shopify sync lease is not valid';
  end if;
  if current_run.cursor is distinct from expected_cursor
    or current_run.pages_processed is distinct from expected_pages_processed
    or current_run.has_next_page is not true
  then
    raise exception 'Shopify sync checkpoint conflict';
  end if;
  if (page_has_next and (
      nullif(btrim(next_cursor), '') is null
      or next_cursor is not distinct from expected_cursor
      or jsonb_array_length(page_variants) = 0
    )) or (jsonb_array_length(page_variants) > 0 and (
      nullif(btrim(next_cursor), '') is null
      or next_cursor is not distinct from expected_cursor
    ))
  then
    raise exception 'Invalid Shopify page progress';
  end if;

  -- Validate the complete batch before the first domain write. Missing keys
  -- are not observed NULLs; unknown/incomplete input never reaches replacement.
  for snapshot in select value from jsonb_array_elements(page_products)
  loop
    content := snapshot -> 'productContent';
    observation := snapshot -> 'collectionObservation';
    if jsonb_typeof(content) is distinct from 'object'
      or not (content ?& array[
        'shopifyProductId', 'productName', 'description', 'seoTitle',
        'seoDescription', 'productHandle', 'productType', 'shopifyCategory',
        'vendor', 'status', 'imageReference', 'shopifyUpdatedAt', 'contentObservedAt'
      ])
    then
      raise exception 'Shopify product content is missing required fields';
    end if;
    foreach field_name in array array[
      'shopifyProductId', 'productName', 'description', 'productHandle',
      'status', 'shopifyUpdatedAt', 'contentObservedAt'
    ] loop
      if jsonb_typeof(content -> field_name) is distinct from 'string' then
        raise exception 'Invalid Shopify content field: %', field_name;
      end if;
    end loop;
    foreach field_name in array array[
      'seoTitle', 'seoDescription', 'productType', 'vendor', 'imageReference'
    ] loop
      if jsonb_typeof(content -> field_name) not in ('string', 'null') then
        raise exception 'Invalid nullable Shopify content field: %', field_name;
      end if;
    end loop;
    product_id := content ->> 'shopifyProductId';
    if product_id !~ '^gid://shopify/Product/[0-9]+$'
      or nullif(btrim(content ->> 'productName'), '') is null
      or nullif(btrim(content ->> 'productHandle'), '') is null
      or content ->> 'status' is distinct from 'ACTIVE'
      or product_id = any(product_ids)
    then
      raise exception 'Invalid or duplicate Shopify product snapshot';
    end if;
    product_ids := array_append(product_ids, product_id);
    foreach field_name in array array['shopifyUpdatedAt', 'contentObservedAt'] loop
      if (content ->> field_name) !~ timestamp_pattern
        or not isfinite((content ->> field_name)::timestamptz)
      then
        raise exception 'Invalid Shopify content timestamp: %', field_name;
      end if;
    end loop;
    if content -> 'shopifyCategory' <> 'null'::jsonb then
      if jsonb_typeof(content -> 'shopifyCategory') is distinct from 'object'
        or jsonb_typeof(content #> '{shopifyCategory,id}') is distinct from 'string'
        or jsonb_typeof(content #> '{shopifyCategory,fullName}') is distinct from 'string'
        or (content #>> '{shopifyCategory,id}') !~ '^gid://shopify/TaxonomyCategory/[A-Za-z0-9_-]+$'
        or nullif(btrim(content #>> '{shopifyCategory,fullName}'), '') is null
      then
        raise exception 'Invalid Shopify category pair';
      end if;
    end if;
    if jsonb_typeof(observation) is distinct from 'object'
      or observation -> 'state' is distinct from '"complete"'::jsonb
      or jsonb_typeof(observation -> 'observedAt') is distinct from 'string'
      or jsonb_typeof(observation -> 'collections') is distinct from 'array'
    then
      raise exception 'Only complete Shopify collection observations may be persisted';
    end if;
    if (observation ->> 'observedAt') !~ timestamp_pattern
      or not isfinite((observation ->> 'observedAt')::timestamptz)
    then
      raise exception 'Invalid Shopify collection observation timestamp';
    end if;
    for member in select value from jsonb_array_elements(observation -> 'collections')
    loop
      if jsonb_typeof(member) is distinct from 'object'
        or not (member ?& array['id', 'title', 'handle'])
        or jsonb_typeof(member -> 'id') is distinct from 'string'
        or (member ->> 'id') !~ '^gid://shopify/Collection/[0-9]+$'
        or jsonb_typeof(member -> 'title') is distinct from 'string'
        or nullif(btrim(member ->> 'title'), '') is null
        or jsonb_typeof(member -> 'handle') not in ('string', 'null')
      then
        raise exception 'Invalid canonical Shopify collection';
      end if;
    end loop;
    if exists (
      select 1 from jsonb_array_elements(observation -> 'collections') as item(value)
      group by item.value ->> 'id' having count(*) > 1
    ) then
      raise exception 'Duplicate canonical Shopify collection identity';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(page_variants) as item(value)
      where item.value ->> 'shopifyProductId' = product_id
    ) then
      raise exception 'Canonical Shopify product is not represented in this page';
    end if;
  end loop;

  for variant in select value from jsonb_array_elements(page_variants)
  loop
    if jsonb_typeof(variant) is distinct from 'object'
      or jsonb_typeof(variant -> 'shopifyProductId') is distinct from 'string'
      or not ((variant ->> 'shopifyProductId') = any(product_ids))
      or jsonb_typeof(variant -> 'shopifyVariantId') is distinct from 'string'
      or (variant ->> 'shopifyVariantId') !~ '^gid://shopify/ProductVariant/[0-9]+$'
      or jsonb_typeof(variant -> 'collections') is distinct from 'array'
    then
      raise exception 'Variant is missing its canonical Shopify product snapshot';
    end if;
    select item.value -> 'collectionObservation' -> 'collections'
    into canonical_members
    from jsonb_array_elements(page_products) as item(value)
    where item.value -> 'productContent' ->> 'shopifyProductId' = variant ->> 'shopifyProductId';
    select coalesce(jsonb_agg(item.value order by item.value ->> 'id'), '[]'::jsonb)
    into canonical_members from jsonb_array_elements(canonical_members) as item(value);
    select coalesce(jsonb_agg(item.value order by item.value ->> 'id'), '[]'::jsonb)
    into legacy_members from jsonb_array_elements(variant -> 'collections') as item(value);
    if canonical_members is distinct from legacy_members then
      raise exception 'Legacy and canonical Shopify collection membership disagree';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(page_variants) as item(value)
    group by item.value ->> 'shopifyVariantId' having count(*) > 1
  ) then
    raise exception 'Duplicate Shopify variant identity in page';
  end if;

  -- Each product is written once, even when all its variants lack a usable SKU.
  -- Stable ordering also keeps canonical lock acquisition deterministic.
  for snapshot in
    select value from jsonb_array_elements(page_products)
    order by value -> 'productContent' ->> 'shopifyProductId'
  loop
    content := snapshot -> 'productContent';
    observation := snapshot -> 'collectionObservation';
    product_id := content ->> 'shopifyProductId';
    insert into public.shopify_product_content (
      shopify_product_id, product_name, description, seo_title, seo_description,
      product_handle, product_type, shopify_category_id, shopify_category_full_name,
      vendor, shopify_status, image_url, shopify_updated_at, content_observed_at, synced_at
    ) values (
      product_id, content ->> 'productName', content ->> 'description',
      content ->> 'seoTitle', content ->> 'seoDescription', content ->> 'productHandle',
      content ->> 'productType', content #>> '{shopifyCategory,id}',
      content #>> '{shopifyCategory,fullName}', content ->> 'vendor', content ->> 'status',
      content ->> 'imageReference', (content ->> 'shopifyUpdatedAt')::timestamptz,
      (content ->> 'contentObservedAt')::timestamptz, clock_timestamp()
    ) on conflict (shopify_product_id) do update set
      product_name = excluded.product_name,
      description = excluded.description,
      seo_title = excluded.seo_title,
      seo_description = excluded.seo_description,
      product_handle = excluded.product_handle,
      product_type = excluded.product_type,
      shopify_category_id = excluded.shopify_category_id,
      shopify_category_full_name = excluded.shopify_category_full_name,
      vendor = excluded.vendor,
      shopify_status = excluded.shopify_status,
      image_url = excluded.image_url,
      shopify_updated_at = excluded.shopify_updated_at,
      content_observed_at = excluded.content_observed_at,
      synced_at = excluded.synced_at;

    delete from public.shopify_product_collections as membership
    where membership.shopify_product_id = product_id;
    insert into public.shopify_product_collections (
      shopify_product_id, shopify_collection_id, title, handle
    )
    select product_id, item.value ->> 'id', item.value ->> 'title', item.value ->> 'handle'
    from jsonb_array_elements(observation -> 'collections') as item(value);

    update public.shopify_product_content as stored
    set collections_complete = true,
        collections_observed_at = (observation ->> 'observedAt')::timestamptz
    where stored.shopify_product_id = product_id;
  end loop;

  if current_run.lease_expires_at <= clock_timestamp() then
    raise exception 'Shopify sync lease expired during page persistence';
  end if;
  -- This is a nested SQL call, NOT a second HTTP RPC. Its existing variant,
  -- legacy collection, seen-ID, counter and checkpoint writes share our transaction.
  -- No exception handler: any failure rolls back every write above as well.
  applied_page := public.apply_shopify_sync_page(
    requested_run_id, requested_lease_token, expected_cursor, next_cursor,
    page_has_next, page_variants, page_lease_seconds
  );
  if current_run.lease_expires_at <= clock_timestamp() then
    raise exception 'Shopify sync lease expired during page persistence';
  end if;
  return applied_page;
end;
$$;

revoke all on function public.apply_shopify_sync_page_v2(
  uuid, uuid, text, integer, text, boolean, jsonb, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.apply_shopify_sync_page_v2(
  uuid, uuid, text, integer, text, boolean, jsonb, jsonb, integer
) to service_role;

-- Claim replacement below retains the existing signature and behavior, adding
-- only persisted hasNextPage to both response branches for final-page recovery.

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
      'hasNextPage', current_run.has_next_page,
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
    'hasNextPage', current_run.has_next_page,
    'processedCount', current_run.processed_count,
    'pagesProcessed', current_run.pages_processed,
    'errorMessage', current_run.error_message,
    'leaseToken', new_lease_token,
    'leaseExpiresAt', current_run.lease_expires_at
  );
end;
$$;


revoke all on function public.claim_shopify_sync_run(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_shopify_sync_run(text, text, integer) to service_role;
