-- Warehouse sales Phase 1: Shopify price and one explicit inventory location.
-- The incoming catalog sync observes Shopify. It never writes public.inventory.

alter table public.products
  add column shopify_price_minor bigint,
  add column shopify_price_currency text,
  add column shopify_inventory_tracked boolean,
  add column shopify_inventory_level_id text,
  add column shopify_inventory_location_id text,
  add column shopify_inventory_observed_at timestamptz;

alter table public.products
  add constraint products_shopify_price_minor_non_negative
    check (shopify_price_minor is null or shopify_price_minor >= 0),
  add constraint products_shopify_price_currency_valid
    check (
      shopify_price_currency is null
      or shopify_price_currency ~ '^[A-Z]{3}$'
    ),
  add constraint products_shopify_inventory_observation_valid
    check (
      shopify_inventory_location_id is null
      or shopify_inventory_observed_at is not null
    );

alter table public.shopify_connections
  add column inventory_location_id text,
  add column inventory_location_name text,
  add column inventory_location_configured_at timestamptz;

alter table public.shopify_connections
  add constraint shopify_connections_inventory_location_valid
    check (
      (
        inventory_location_id is null
        and inventory_location_name is null
        and inventory_location_configured_at is null
      )
      or
      (
        inventory_location_id ~ '^gid://shopify/Location/[0-9]+$'
        and nullif(btrim(inventory_location_name), '') is not null
        and inventory_location_configured_at is not null
      )
    );

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
  variant_location_id text;
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
    variant_location_id :=
      nullif(variant ->> 'shopifyInventoryLocationId', '');
    local_product_id := null;

    if variant_id is null then
      raise exception 'Shopify variant is missing its technical ID';
    end if;

    if variant_location_id is null then
      raise exception 'Shopify variant is missing inventory location';
    end if;

    if (variant ->> 'shopifyPriceMinor') is null
      or (variant ->> 'shopifyPriceMinor')::bigint < 0
    then
      raise exception 'Shopify variant has an invalid price';
    end if;

    if nullif(variant ->> 'shopifyPriceCurrency', '') is null then
      raise exception 'Shopify variant is missing price currency';
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
        shopify_price_minor,
        shopify_price_currency,
        shopify_inventory_tracked,
        shopify_inventory_level_id,
        shopify_inventory_location_id,
        shopify_inventory_observed_at,
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
        (variant ->> 'shopifyQuantity')::integer,
        (variant ->> 'shopifyPriceMinor')::bigint,
        upper(variant ->> 'shopifyPriceCurrency'),
        coalesce((variant ->> 'shopifyInventoryTracked')::boolean, false),
        nullif(variant ->> 'shopifyInventoryLevelId', ''),
        variant_location_id,
        now(),
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
          shopify_quantity = (variant ->> 'shopifyQuantity')::integer,
          shopify_price_minor =
            (variant ->> 'shopifyPriceMinor')::bigint,
          shopify_price_currency =
            upper(variant ->> 'shopifyPriceCurrency'),
          shopify_inventory_tracked =
            coalesce(
              (variant ->> 'shopifyInventoryTracked')::boolean,
              false
            ),
          shopify_inventory_level_id =
            nullif(variant ->> 'shopifyInventoryLevelId', ''),
          shopify_inventory_location_id = variant_location_id,
          shopify_inventory_observed_at = now(),
          shopify_product_id = variant ->> 'shopifyProductId',
          shopify_variant_id = variant_id,
          shopify_inventory_item_id =
            nullif(variant ->> 'shopifyInventoryItemId', ''),
          shopify_status = variant ->> 'shopifyStatus',
          synced_at = now()
      where id = local_product_id;
    end if;

    delete from public.product_collections
    where product_id = local_product_id;

    for collection in
      select value
      from jsonb_array_elements(
        coalesce(variant -> 'collections', '[]'::jsonb)
      )
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
      lease_expires_at =
        now() + make_interval(secs => page_lease_seconds),
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

-- Keep the replacement RPC service-role-only.
revoke all on function public.apply_shopify_sync_page(
  uuid, uuid, text, text, boolean, jsonb, integer
) from public, anon, authenticated;

grant execute on function public.apply_shopify_sync_page(
  uuid, uuid, text, text, boolean, jsonb, integer
) to service_role;
