-- Forward only, after the complete seven-migration Phase 2A chain.
-- No data rewrite, identity reassignment, inventory changes or historical edits.
alter table public.products drop constraint products_sku_key;
drop index public.products_sku_unique;
-- Preserve the existing non-unique lookup index (and ensure it exists).
create index if not exists idx_products_sku on public.products(sku);

-- Short finalization barrier, not a reservation system. EXCLUSIVE also conflicts
-- with ROW SHARE (SELECT FOR UPDATE/SHARE), avoiding a later row-lock inversion.
-- Ordinary reads remain possible. Any busy table aborts with 55P03 immediately.
create function private.lock_catalog_reconciliation_v1() returns void
language plpgsql security invoker set search_path='' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Catalog reconciliation requires read committed visibility';
  end if;
  lock table public.pick_jobs, public.orders, public.order_lines, public.pick_lines,
    public.pick_exceptions, public.products, public.inventory,
    public.warehouse_sale_lines, public.warehouse_sale_shopify_sync_jobs
    in exclusive mode nowait;
end; $$;
revoke all on function private.lock_catalog_reconciliation_v1() from public,anon,authenticated,service_role;

-- Operator diagnostic only; no public API or new UI. Completion calls this only
-- AFTER the barrier. Outside that transaction it is a descriptive snapshot.
create function private.catalog_deactivation_blockers_v1(requested_run_id uuid)
returns table(product_id uuid, shopify_variant_id text, dependencies text[])
language sql stable security invoker set search_path='' as $$
  select p.id,p.shopify_variant_id,r.dependencies
  from public.products p
  cross join lateral (select array_remove(array[
    case when exists(select 1 from public.inventory i where i.product_id=p.id and i.quantity>0) then 'physical_stock' end,
    case when exists(select 1 from public.order_lines l join public.orders o on o.id=l.order_id
      where (l.product_id=p.id or l.shopify_variant_id=p.shopify_variant_id)
        and o.status in ('received','ready_to_pick','picking')) then 'active_order' end,
    case when exists(select 1 from public.pick_lines l join public.pick_jobs j on j.id=l.pick_job_id
      where l.product_id=p.id and j.status in ('ready','in_progress')) then 'active_pick' end,
    case when exists(select 1 from public.pick_exceptions e join public.pick_lines l on l.id=e.pick_line_id
      where l.product_id=p.id and e.status='open') then 'open_pick_exception' end,
    case when exists(select 1 from public.warehouse_sale_lines l join public.warehouse_sale_shopify_sync_jobs j on j.warehouse_sale_id=l.sale_id
      where l.product_id=p.id and j.status in ('pending','processing','failed')) then 'unfinished_sale_sync' end
  ]::text[],null) as dependencies) r
  where p.active and p.shopify_variant_id is not null
    and exists(select 1 from private.sync_runs where id=requested_run_id)
    and not exists(select 1 from private.sync_run_variants v where v.run_id=requested_run_id and v.shopify_variant_id=p.shopify_variant_id)
    and cardinality(r.dependencies)>0;
$$;
revoke all on function private.catalog_deactivation_blockers_v1(uuid) from public,anon,authenticated,service_role;

create or replace function private.apply_shopify_sync_page(
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
    where shopify_variant_id = variant_id
    for update;

    -- Variant ID alone is identity. Null/duplicate SKU never changes matching.

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
      set sku = variant_sku,
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

create or replace function private.complete_shopify_sync_run(
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
  blocked_count bigint;
  blocked_examples jsonb;
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

  if current_run.has_next_page or current_run.pages_processed < 1 then
    raise exception 'Shopify sync cannot complete before the final page';
  end if;

  -- No external work while locks are held. NOWAIT prevents lock inversion waits.
  perform private.lock_catalog_reconciliation_v1();
  select count(*) into blocked_count from private.catalog_deactivation_blockers_v1(requested_run_id);
  if blocked_count > 0 then
    select jsonb_agg(to_jsonb(b) order by b.product_id) into blocked_examples
    from (select * from private.catalog_deactivation_blockers_v1(requested_run_id) order by product_id limit 24) b;
    raise exception using errcode='P0001', message='SHOPIFY_DEACTIVATION_BLOCKED',
      detail=jsonb_build_object('blockedCount',blocked_count,'examples',blocked_examples,
        'truncated',blocked_count>24)::text,
      hint='Inspect private.catalog_deactivation_blockers_v1(run_id). Resolve active dependencies explicitly; do not reset checkpoints.';
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

create or replace function public.apply_shopify_backfill_page_v1(requested_operation uuid, requested_run_id uuid, requested_lease_token uuid,
  expected_cursor text, expected_pages_processed integer, next_cursor text, page_has_next boolean,
  page_variants jsonb, page_products jsonb, traversal_evidence jsonb)
returns jsonb language plpgsql security definer set search_path = '' set timezone='UTC' as $$
declare result jsonb; source jsonb; content jsonb; members jsonb; desired jsonb; facts jsonb:='[]'; variant_facts jsonb:='[]';
  prior public.products%rowtype; evidence jsonb; previous_context text:=current_setting('snake.backfill_operation',true);
begin
  perform 1 from private.shopify_backfill_operations where operation_id=requested_operation and run_id=requested_run_id for update;
  if not found then raise exception 'Bound operation required'; end if;
  if jsonb_typeof(page_variants) is distinct from 'array' or jsonb_typeof(page_products) is distinct from 'array'
    or jsonb_typeof(traversal_evidence) is distinct from 'array' or jsonb_array_length(page_variants)>20
    or jsonb_array_length(page_products)>20 or jsonb_array_length(traversal_evidence) is distinct from jsonb_array_length(page_products)
    or octet_length(traversal_evidence::text)>16384 then raise exception 'Bounded traversal evidence required'; end if;
  for source in select value from jsonb_array_elements(page_products) loop
    content := source -> 'productContent';
    if (content->>'contentObservedAt')::timestamptz < (select started_at from private.shopify_backfill_operations where operation_id=requested_operation)
      or (source #>> '{collectionObservation,observedAt}')::timestamptz < (content->>'contentObservedAt')::timestamptz then raise exception 'Observation predates protected traversal'; end if;
    select value into evidence from jsonb_array_elements(traversal_evidence) where value->>'productId'=content->>'shopifyProductId';
    if evidence is null or evidence->>'finalHasNextPage' is distinct from 'false'
      or (evidence->>'pageCount')::integer < 1 or (evidence->>'pageCount') is null
      or (evidence->>'cursorDigest' ~ '^[a-f0-9]{64}$') is not true
      or (evidence->>'membershipCount')::integer is distinct from jsonb_array_length(source #> '{collectionObservation,collections}')
      or evidence->>'observedAt' is distinct from source #>> '{collectionObservation,observedAt}' then raise exception 'Missing terminal traversal evidence'; end if;
    content := content || jsonb_build_object('shopifyUpdatedAt',(content->>'shopifyUpdatedAt')::timestamptz,'contentObservedAt',(content->>'contentObservedAt')::timestamptz);
    select coalesce(jsonb_agg(value order by value->>'id' collate "C"),'[]') into members from jsonb_array_elements(source #> '{collectionObservation,collections}');
    facts := facts || jsonb_build_array(jsonb_build_object('productId',content->>'shopifyProductId','contentDigest',private.backfill_hash(content),
      'memberDigest',private.backfill_hash(members),'memberCount',jsonb_array_length(members),
      'contentObservedAt',(content->>'contentObservedAt')::timestamptz,'collectionsObservedAt',(evidence->>'observedAt')::timestamptz,
      'collectionPages',(evidence->>'pageCount')::integer,'finalHasNextPage',false,'cursorDigest',evidence->>'cursorDigest'));
  end loop;
  for source in select value from jsonb_array_elements(page_variants) loop
    select * into prior from public.products where shopify_variant_id=source->>'shopifyVariantId';
    select coalesce(jsonb_agg(jsonb_build_object('id',value->>'id','title',value->>'title','handle',nullif(value->>'handle','')) order by value->>'id' collate "C"),'[]') into members from jsonb_array_elements(source->'collections');
    desired:=jsonb_build_object('sku',nullif(btrim(source->>'sku'),''),'active',true,'productName',source->>'productName',
      'variantName',nullif(source->>'variantName',''),'productId',source->>'shopifyProductId','priceMinor',(source->>'shopifyPriceMinor')::bigint,
      'currency',upper(source->>'shopifyPriceCurrency'),'quantity',(source->>'shopifyQuantity')::integer,
      'tracked',coalesce((source->>'shopifyInventoryTracked')::boolean,false),'locationId',source->>'shopifyInventoryLocationId',
      'inventoryItemId',nullif(source->>'shopifyInventoryItemId',''),'inventoryLevelId',nullif(source->>'shopifyInventoryLevelId',''),
      'status',source->>'shopifyStatus','productType',nullif(source->>'productType',''),'vendor',nullif(source->>'vendor',''),
      'imageUrl',nullif(source->>'imageUrl',''),'collections',members);
    variant_facts:=variant_facts || jsonb_build_array(jsonb_build_object('variantId',source->>'shopifyVariantId','skipped',false,'digest',private.backfill_hash(desired),'priorId',prior.id,'memberCount',jsonb_array_length(members)));
  end loop;
  perform set_config('snake.backfill_operation',requested_operation::text,true);
  result:=private.apply_shopify_sync_page_v2(requested_run_id,requested_lease_token,expected_cursor,expected_pages_processed,next_cursor,page_has_next,page_variants,page_products,90);
  perform set_config('snake.backfill_operation',coalesce(previous_context,''),true);
  -- Independent projections of persisted state must agree with source expectations.
  for evidence in select value from jsonb_array_elements(facts) loop
    if evidence->>'contentDigest' is distinct from private.backfill_hash(private.backfill_content_fact(evidence->>'productId'))
      or evidence->>'memberDigest' is distinct from private.backfill_hash(private.backfill_member_fact(evidence->>'productId')) then raise exception 'Canonical source/persistence disagreement'; end if;
  end loop;
  for evidence in select value from jsonb_array_elements(variant_facts) where value->>'skipped'='false' loop
    if evidence->>'digest' is distinct from private.backfill_hash(private.backfill_variant_fact(evidence->>'variantId'))
      or (evidence->>'priorId' is not null and not exists(select 1 from public.products where shopify_variant_id=evidence->>'variantId' and id=(evidence->>'priorId')::uuid)) then raise exception 'Variant/legacy source/persistence disagreement'; end if;
  end loop;
  insert into private.shopify_backfill_pages(operation_id,page_number,expected_cursor,next_cursor,has_next,payload_digest,evidence)
  values(requested_operation,expected_pages_processed+1,expected_cursor,next_cursor,page_has_next,
    private.backfill_hash(jsonb_build_object('variants',page_variants,'products',page_products)),
    jsonb_build_object('version',1,'outcome','committed','products',facts,'variants',variant_facts));
  -- Failure anywhere, including receipt insertion, rolls back V2 and checkpoint.
  return result;
end; $$;

create or replace function public.complete_shopify_backfill_v1(requested_operation uuid, requested_run_id uuid, approved_preview jsonb, confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare preview jsonb; claim jsonb; saved jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('snake_shopify_sync',0));
  select o.approved_preview into saved from private.shopify_backfill_operations o where operation_id=requested_operation and run_id=requested_run_id for update;
  if not found or approved_preview is null or confirmation is null or confirmation is distinct from ('COMPLETE ' || requested_operation || ' ' || requested_run_id || ' ' || (approved_preview->>'affectedDigest')) then raise exception 'Explicit bound reconciliation approval required'; end if;
  if exists(select 1 from private.sync_runs where id=requested_run_id and status='completed') then
    if saved is distinct from approved_preview then raise exception 'Completion approval mismatch'; end if;
    return public.get_shopify_sync_run(requested_run_id);
  end if;
  -- Freeze the reconciliation population between preview validation and completion.
  claim:=private.claim_shopify_sync_run('manual',null,90);
  if claim->>'acquired' is distinct from 'true' or claim->>'runId' is distinct from requested_run_id::text then raise exception 'Completion requires reclaimed bound lease'; end if;
  -- operation -> run -> dependency tables; no blocking table-lock upgrade.
  perform private.lock_catalog_reconciliation_v1();
  preview:=public.preview_shopify_backfill_v1(requested_operation);
  if preview->>'ready' is distinct from 'true' or preview is distinct from approved_preview then raise exception 'Reconciliation preview changed or final page not committed'; end if;
  if (select count(*) from private.shopify_backfill_pages where operation_id=requested_operation) is distinct from (preview->>'pagesProcessed')::bigint then raise exception 'Incomplete page provenance'; end if;
  perform private.complete_shopify_sync_run(requested_run_id,(claim->>'leaseToken')::uuid);
  update private.shopify_backfill_operations o set completed_at=clock_timestamp(),approved_preview=complete_shopify_backfill_v1.approved_preview where operation_id=requested_operation;
  return public.get_shopify_sync_run(requested_run_id);
end; $$;

create or replace function public.get_shopify_backfill_proof_facts_v1(requested_operation uuid)
returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare
  result jsonb; coverage jsonb; counts jsonb; ranges jsonb; targets jsonb;
  operation private.shopify_backfill_operations%rowtype;
  trim_chars constant text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  select * into strict operation from private.shopify_backfill_operations where operation_id=requested_operation;
  -- Correlated membership counts deliberately avoid the reader's aggregate join.
  with population as materialized (
    select v.shopify_product_id, count(*) as variants from public.products v
    where v.active=true and v.shopify_product_id is not null group by v.shopify_product_id
  ), facts as materialized (
    select p.*,c.content_observed_at,c.collections_observed_at,c.shopify_updated_at,c.synced_at,
      coalesce(c.collections_complete,false) as complete,
      c.shopify_product_id is not null as canonical_row,
      (select count(*) from public.shopify_product_collections m where m.shopify_product_id=p.shopify_product_id) as members,
      jsonb_build_object('productName',c.product_name,'description',c.description,'seoTitle',c.seo_title,
        'seoDescription',c.seo_description,'productHandle',c.product_handle,'productType',c.product_type,
        'imageReference',c.image_url,'shopifyCategory',case when (c.shopify_category_id ~ '^gid://shopify/TaxonomyCategory/[A-Za-z0-9_-]+$') is true then c.shopify_category_full_name end) as values
    from population p left join public.shopify_product_content c using(shopify_product_id)
  ), states as materialized (
    select f.shopify_product_id,e.key,
      case when f.content_observed_at is null then 'unknown'
        when nullif(btrim(e.value,trim_chars),'') is null then 'missing' else 'present' end as state
    from facts f cross join lateral jsonb_each_text(f.values) e
  ), keys(key) as (values ('productName'),('description'),('seoTitle'),('seoDescription'),('productHandle'),('productType'),('imageReference'),('shopifyCategory')),
  field_counts as (
    select k.key,jsonb_build_object('unknownCount',count(*) filter(where s.state='unknown'),
      'missingCount',count(*) filter(where s.state='missing'),'presentCount',count(*) filter(where s.state='present')) as value
    from keys k left join states s using(key) group by k.key
  ), sample_candidates as (
    select v.*,f.variants,f.complete,f.members,f.content_observed_at,
      case when f.content_observed_at is null then 0 when not f.complete then 1 when f.members=0 then 2
        when f.members>24 then 3 when f.variants>25 then 4
        when exists(select 1 from states s where s.shopify_product_id=f.shopify_product_id and s.state='missing') then 5 else 6 end as bucket
    from public.products v join facts f using(shopify_product_id)
    where v.active=true and char_length(v.sku) between 1 and 120 and nullif(btrim(v.sku,trim_chars),'') is not null
      and not exists(select 1 from public.products duplicate where duplicate.active and duplicate.shopify_product_id is not null
        and duplicate.sku=v.sku and duplicate.id<>v.id)
      and v.sku !~* 'gid://shopify/' and v.sku !~ U&'[\0001-\001F\007F-\009F]'
  ), samples as (
    select *,row_number() over(partition by bucket order by shopify_product_id collate "C",sku collate "C",id) as rank from sample_candidates
  ), selected as (select * from samples order by rank,bucket,shopify_product_id collate "C",sku collate "C",id limit 8)
  select jsonb_build_object(
    'totals',jsonb_build_object('productCount',(select count(*) from facts),'variantCount',coalesce((select sum(variants) from facts),0)),
    'contentCoverage',jsonb_build_object('observedProductCount',(select count(*) from facts where content_observed_at is not null),'unknownProductCount',(select count(*) from facts where content_observed_at is null)),
    'fields',(select jsonb_object_agg(key,value) from field_counts),
    'collections',jsonb_build_object('unknownOrIncompleteProductCount',(select count(*) from facts where not complete),'completeProductCount',(select count(*) from facts where complete),
      'completeWithZeroCollectionsCount',(select count(*) from facts where complete and members=0),'completeWithCollectionsCount',(select count(*) from facts where complete and members>0)),
    'collectionDetail',jsonb_build_object('noCanonicalRow',(select count(*) from facts where not canonical_row),'incompleteCanonicalRow',(select count(*) from facts where canonical_row and not complete)),
    'targetEligibleCount',(select count(*) from sample_candidates)) into coverage;

  -- Separate scalar range queries retain empty populations and exclude unknown metadata.
  with kinds(key,unit) as (values ('variantSyncedAt','variant'),('contentObservedAt','product'),('collectionsObservedAt','product'),('shopifyUpdatedAt','product'),('contentPersistedAt','product')),
  active as (select distinct shopify_product_id from public.products where active and shopify_product_id is not null),
  timestamps as (
    select 'variantSyncedAt'::text as key,p.synced_at as value from public.products p where active and shopify_product_id is not null
    union all select t.key,t.value from active a left join public.shopify_product_content c using(shopify_product_id)
    cross join lateral (values ('contentObservedAt',c.content_observed_at),('collectionsObservedAt',case when c.collections_complete then c.collections_observed_at end),
      ('shopifyUpdatedAt',case when c.content_observed_at is not null then c.shopify_updated_at end),('contentPersistedAt',case when c.content_observed_at is not null then c.synced_at end)) t(key,value)
  ) select jsonb_object_agg(k.key,jsonb_build_object('populationUnit',k.unit,'populationCount',case when k.unit='variant' then coverage#>'{totals,variantCount}' else coverage#>'{totals,productCount}' end,
      'timestampCount',(select count(value) from timestamps where key=k.key),'oldest',(select min(value) from timestamps where key=k.key),'newest',(select max(value) from timestamps where key=k.key))) into ranges from kinds k;

  -- Same deterministic allocation, independently projected expectations, at most eight.
  with candidates as (
    select p.*,c.content_observed_at,c.collections_complete,
      (select count(*) from public.products v where v.active and v.shopify_product_id=p.shopify_product_id) as variants,
      (select count(*) from public.shopify_product_collections m where m.shopify_product_id=p.shopify_product_id) as members,
      c.product_name as canonical_name,c.description,c.seo_title,c.seo_description,c.product_handle,c.product_type as canonical_type,c.image_url as canonical_image,c.shopify_category_id,c.shopify_category_full_name
    from public.products p left join public.shopify_product_content c using(shopify_product_id)
    where p.active and p.shopify_product_id is not null and char_length(p.sku) between 1 and 120 and nullif(btrim(p.sku,trim_chars),'') is not null
      and not exists(select 1 from public.products duplicate where duplicate.active and duplicate.shopify_product_id is not null
        and duplicate.sku=p.sku and duplicate.id<>p.id)
      and p.sku !~* 'gid://shopify/' and p.sku !~ U&'[\0001-\001F\007F-\009F]'
  ), field_states as (
    select p.*, (select jsonb_object_agg(f.key,case when p.content_observed_at is null then 'unknown' when nullif(btrim(f.value,trim_chars),'') is null then 'missing' else 'present' end)
      from (values ('productName',p.canonical_name),('description',p.description),('seoTitleOverride',p.seo_title),('seoDescriptionOverride',p.seo_description),('productHandle',p.product_handle),('productType',p.canonical_type),('imageReference',p.canonical_image),
        ('shopifyCategory',case when (p.shopify_category_id ~ '^gid://shopify/TaxonomyCategory/[A-Za-z0-9_-]+$') is true then p.shopify_category_full_name end)) f(key,value)) as states from candidates p
  ), bucketed as (
    select *,case when content_observed_at is null then 0 when not coalesce(collections_complete,false) then 1 when members=0 then 2 when members>24 then 3 when variants>25 then 4
      when states::text like '%"missing"%' then 5 else 6 end as bucket from field_states
  ), ranked as (select *,row_number() over(partition by bucket order by shopify_product_id collate "C",sku collate "C",id) as rank from bucketed),
  selected as (select * from ranked order by rank,bucket,shopify_product_id collate "C",sku collate "C",id limit 8)
  select coalesce(jsonb_agg(jsonb_build_object('sku',sku,'fieldStates',states,'variantCount',variants,
    'collectionState',case when collections_complete then 'complete' else 'unknown_or_incomplete' end,'membershipCount',case when collections_complete then members end,
    'priceMinor',shopify_price_minor,'quantity',shopify_quantity,'inventoryTracked',shopify_inventory_tracked) order by rank,bucket,shopify_product_id collate "C",sku collate "C",id),'[]') into targets from selected;

  with pages as materialized (
    select *,lag(next_cursor) over(order by page_number) as prior_cursor,lag(has_next) over(order by page_number) as prior_next from private.shopify_backfill_pages where operation_id=requested_operation
  ), all_products as (select page_number,p.value from pages cross join lateral jsonb_array_elements(evidence->'products') p),
  latest_products as (select distinct on (value->>'productId') value from all_products order by value->>'productId',page_number desc),
  all_variants as (select page_number,v.value from pages cross join lateral jsonb_array_elements(evidence->'variants') v),
  latest_variants as (select distinct on (value->>'variantId') value from all_variants order by value->>'variantId',page_number desc)
  select jsonb_build_object('receiptPages',(select count(*) from pages),'runPages',r.pages_processed,
    'chainValid',coalesce((select bool_and(page_number>=1 and (page_number<>1 or expected_cursor is null)
      and (page_number=1 or (prior_next and expected_cursor is not distinct from prior_cursor))) and min(page_number)=1 and max(page_number)=count(*) from pages),false),
    'finalPageCommitted',r.has_next_page=false and (select has_next=false and next_cursor is not distinct from r.cursor from pages order by page_number desc limit 1),
    'sourceEvidenceValid',not exists(select 1 from all_products where (value->>'finalHasNextPage') is distinct from 'false'
      or (value->>'collectionPages')::integer<1 or (value->>'cursorDigest' ~ '^[a-f0-9]{64}$') is not true
      or (value->>'collectionsObservedAt')::timestamptz < (value->>'contentObservedAt')::timestamptz),
    'contentMismatches',(select count(*) from latest_products where value->>'contentDigest' is distinct from private.backfill_hash(private.backfill_content_fact(value->>'productId'))),
    'collectionMismatches',(select count(*) from latest_products x left join public.shopify_product_content c on c.shopify_product_id=x.value->>'productId'
      where c.collections_complete is distinct from true or c.collections_observed_at is distinct from (x.value->>'collectionsObservedAt')::timestamptz
        or x.value->>'memberDigest' is distinct from private.backfill_hash(private.backfill_member_fact(x.value->>'productId'))),
    'variantMismatches',(select count(*) from latest_variants where value->>'skipped'='false' and value->>'digest' is distinct from private.backfill_hash(private.backfill_variant_fact(value->>'variantId'))),
    'activeProductsWithoutReceipt',(select count(distinct p.shopify_product_id) from public.products p where p.active and p.shopify_product_id is not null and not exists(select 1 from latest_products l where l.value->>'productId'=p.shopify_product_id)),
    'counterAgreement',r.processed_count=(select count(*) from all_variants where value->>'skipped'='false') and r.skipped_no_sku=(select count(*) from all_variants where value->>'skipped'='true')
      and r.collections_linked=coalesce((select sum((value->>'memberCount')::integer) from all_variants where value->>'skipped'='false'),0),
    'inventoryUnchanged',operation.baseline->>'inventoryDigest'=private.backfill_inventory_hash(),
    'reconciliationAgreement',case when r.status='completed' then r.reconciled_count=(operation.approved_preview->>'updatedRows')::integer and not exists(select 1 from public.products p where p.shopify_variant_id is not null and (p.active or p.shopify_status is distinct from 'NOT_ACTIVE')
      and not exists(select 1 from private.sync_run_variants v where v.run_id=r.id and v.shopify_variant_id=p.shopify_variant_id)) else null end,
    'receiptDigest',(select private.backfill_hash(to_jsonb(coalesce(string_agg(payload_digest,'|' order by page_number),''))) from pages)) into counts from private.sync_runs r where r.id=operation.run_id;
  result:=coverage || jsonb_build_object('schemaVersion',1,'operation',to_jsonb(operation)-'baseline','run',public.get_shopify_sync_run(operation.run_id),
    'databaseFunctionHashes',operation.baseline->'functionHashes','freshness',ranges,'provenance',counts,'targets',targets,'sampleLimit',8);
  if octet_length(result::text)>65536 then raise exception 'Proof facts exceed bounded response'; end if;
  return result;
end; $$;

-- CREATE OR REPLACE retains existing grants; explicitly retain private isolation.
revoke all on function private.apply_shopify_sync_page(uuid,uuid,text,text,boolean,jsonb,integer),
  private.complete_shopify_sync_run(uuid,uuid) from public,anon,authenticated,service_role;
