-- Commit 8: offline forward artifact. No admission/population occurs on migration.
-- Preserve UNKNOWN (null/null), MISSING (null/null after observation) and valid category pairs.
alter table public.shopify_product_content drop constraint shopify_product_content_category_valid;
alter table public.shopify_product_content add constraint shopify_product_content_category_valid check ((
  (shopify_category_id is null and shopify_category_full_name is null)
  or (shopify_category_id ~ '^gid://shopify/TaxonomyCategory/[A-Za-z0-9_-]+$'
    and nullif(btrim(shopify_category_full_name, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), '') is not null)
) is true);

create table private.shopify_backfill_operations (
  operation_id uuid primary key,
  run_id uuid not null unique references private.sync_runs(id),
  identity jsonb not null,
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  claim_count integer not null default 0,
  recovery_reads integer not null default 0,
  last_recovered_state jsonb,
  approved_preview jsonb,
  baseline jsonb not null
);
create table private.shopify_backfill_pages (
  operation_id uuid not null references private.shopify_backfill_operations(operation_id),
  page_number integer not null check (page_number > 0),
  expected_cursor text check (octet_length(expected_cursor)<=4096), next_cursor text check (octet_length(next_cursor)<=4096), has_next boolean not null,
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  evidence jsonb not null check (octet_length(evidence::text) <= 65536),
  committed_at timestamptz not null default clock_timestamp(),
  primary key (operation_id, page_number)
);
revoke all on private.shopify_backfill_operations, private.shopify_backfill_pages from public, anon, authenticated, service_role;

create function private.backfill_hash(value jsonb) returns text
language sql immutable set search_path = '' as $$ select encode(sha256(convert_to(value::text, 'UTF8')), 'hex'); $$;
create function private.backfill_inventory_hash() returns text
language sql stable security definer set search_path = '' as $$
 select private.backfill_hash(to_jsonb(coalesce(string_agg(private.backfill_hash(to_jsonb(i)), '' order by i.id), '')))
 from public.inventory i;
$$;

-- Move existing implementations intact behind restricted entry points. Old
-- signatures remain as guarded wrappers, preserving ordinary worker semantics.
alter function public.claim_shopify_sync_run(text,text,integer) set schema private;
alter function public.apply_shopify_sync_page(uuid,uuid,text,text,boolean,jsonb,integer) set schema private;
alter function public.apply_shopify_sync_page_v2(uuid,uuid,text,integer,text,boolean,jsonb,jsonb,integer) set schema private;
alter function public.complete_shopify_sync_run(uuid,uuid) set schema private;
alter function public.pause_shopify_sync_run(uuid,uuid,text) set schema private;
alter function public.fail_shopify_sync_run(uuid,uuid,text) set schema private;
revoke all on function private.claim_shopify_sync_run(text,text,integer),
  private.apply_shopify_sync_page(uuid,uuid,text,text,boolean,jsonb,integer),
  private.apply_shopify_sync_page_v2(uuid,uuid,text,integer,text,boolean,jsonb,jsonb,integer),
  private.complete_shopify_sync_run(uuid,uuid), private.pause_shopify_sync_run(uuid,uuid,text),
  private.fail_shopify_sync_run(uuid,uuid,text) from public, anon, authenticated, service_role;

create function private.backfill_guard(requested_run_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from private.shopify_backfill_operations o where o.run_id = requested_run_id
    and o.operation_id::text is distinct from current_setting('snake.backfill_operation', true)) then
    raise exception 'Protected operation requires its bound control path';
  end if;
end; $$;

create function public.claim_shopify_sync_run(requested_source text, requested_actor_email text default null, requested_lease_seconds integer default 90)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare protected_run uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('snake_shopify_sync', 0));
  select o.run_id into protected_run from private.shopify_backfill_operations o
    join private.sync_runs r on r.id = o.run_id where r.status <> 'completed';
  if protected_run is not null then
    return public.get_shopify_sync_run(protected_run) || jsonb_build_object('acquired', false, 'protected', true);
  end if;
  return private.claim_shopify_sync_run(requested_source, requested_actor_email, requested_lease_seconds);
end; $$;
create function public.apply_shopify_sync_page(requested_run_id uuid, requested_lease_token uuid, expected_cursor text,
  next_cursor text, page_has_next boolean, page_variants jsonb, page_lease_seconds integer default 90)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.backfill_guard(requested_run_id);
  return private.apply_shopify_sync_page(requested_run_id, requested_lease_token, expected_cursor, next_cursor, page_has_next, page_variants, page_lease_seconds);
end; $$;
create function public.apply_shopify_sync_page_v2(requested_run_id uuid, requested_lease_token uuid, expected_cursor text,
  expected_pages_processed integer, next_cursor text, page_has_next boolean, page_variants jsonb, page_products jsonb, page_lease_seconds integer default 90)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.backfill_guard(requested_run_id);
  return private.apply_shopify_sync_page_v2(requested_run_id, requested_lease_token, expected_cursor, expected_pages_processed, next_cursor, page_has_next, page_variants, page_products, page_lease_seconds);
end; $$;
create function public.complete_shopify_sync_run(requested_run_id uuid, requested_lease_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.backfill_guard(requested_run_id);
  return private.complete_shopify_sync_run(requested_run_id, requested_lease_token);
end; $$;
create function public.pause_shopify_sync_run(requested_run_id uuid, requested_lease_token uuid, requested_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.backfill_guard(requested_run_id);
  return private.pause_shopify_sync_run(requested_run_id, requested_lease_token, requested_reason);
end; $$;
create function public.fail_shopify_sync_run(requested_run_id uuid, requested_lease_token uuid, requested_error_message text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.backfill_guard(requested_run_id);
  return private.fail_shopify_sync_run(requested_run_id, requested_lease_token, requested_error_message);
end; $$;

create function public.get_shopify_backfill_plan_v1(requested_shop text, requested_operation uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('schemaVersion', 1, 'database', current_database(), 'postgresVersion', current_setting('server_version'),
  'controlVersion', 'phase2a_backfill_v1', 'writerVersion', 'apply_shopify_sync_page_v2',
  'requiredMigrationVersions',jsonb_build_array('20260907195256','20260917192405','20260917200011','20260919090000','20260919093000','20260919094000'),
  'categoryConstraint',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.shopify_product_content'::regclass and conname='shopify_product_content_category_valid'),
  'proofAvailable',to_regprocedure('public.get_shopify_backfill_proof_facts_v1(uuid)') is not null,
  'functions', (select jsonb_object_agg(p.proname, md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('get_roy_catalog_foundation_v1','get_roy_targeted_product_v1','apply_shopify_sync_page_v2','start_shopify_backfill_v1')),
  'shop', requested_shop, 'locationId', (select inventory_location_id from public.shopify_connections where shop=requested_shop),
  'connectionAvailable', exists(select 1 from public.shopify_connections where shop=requested_shop and access_token is not null),
  'gateState', 'external_verification_required',
  'resumableRun', (select public.get_shopify_sync_run(id) from private.sync_runs where status <> 'completed'),
  'operation', (select to_jsonb(o) from private.shopify_backfill_operations o where operation_id=requested_operation),
  'run', (select public.get_shopify_sync_run(run_id) from private.shopify_backfill_operations where operation_id=requested_operation),
  'committedEvidencePages', (select count(*) from private.shopify_backfill_pages where operation_id=requested_operation),
  'latestReceipt', (select to_jsonb(p) from private.shopify_backfill_pages p where operation_id=requested_operation order by page_number desc limit 1));
$$;

create function public.start_shopify_backfill_v1(requested_operation uuid, requested_identity jsonb, confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing private.shopify_backfill_operations%rowtype; claim jsonb; baseline jsonb;
begin
  if requested_operation is null or requested_identity is null or jsonb_typeof(requested_identity) <> 'object'
    or (requested_identity ->> 'codeRevision' ~ '^[a-f0-9]{40}$') is not true
    or (requested_identity ->> 'projectRef' ~ '^[a-z0-9]{20}$') is not true
    or nullif(confirmation, '') is null
    or requested_identity ->> 'runtimeGateDisabled' is distinct from 'true'
    or requested_identity ->> 'contractVersion' is distinct from 'phase2a_backfill_v1'
    or confirmation is distinct from ('START ' || requested_operation || ' ' || (requested_identity ->> 'projectRef') || ' ' || (requested_identity ->> 'shop'))
    or octet_length(requested_identity::text) > 4096 then raise exception 'Explicit target-bound start approval required'; end if;
  if not exists(select 1 from public.shopify_connections where shop = requested_identity ->> 'shop'
    and inventory_location_id = requested_identity ->> 'locationId' and access_token is not null) then raise exception 'Store/location mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('snake_shopify_sync', 0));
  select * into existing from private.shopify_backfill_operations where operation_id=requested_operation;
  if found then
    if existing.identity is distinct from requested_identity then raise exception 'Operation identity mismatch'; end if;
    return public.get_shopify_sync_run(existing.run_id) || jsonb_build_object('acquired', false, 'operationId', requested_operation);
  end if;
  if exists(select 1 from private.sync_runs where status <> 'completed') then raise exception 'Existing resumable run blocks fresh admission'; end if;
  baseline := jsonb_build_object('inventoryDigest', private.backfill_inventory_hash(),
    'functionHashes',(select jsonb_object_agg(n.nspname||'.'||p.proname,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private') and p.proname in ('apply_shopify_sync_page_v2','get_roy_catalog_foundation_v1','get_roy_targeted_product_v1','apply_shopify_backfill_page_v1','get_shopify_backfill_proof_facts_v1')),
    'activeProducts', (select count(distinct shopify_product_id) from public.products where active and shopify_product_id is not null),
    'activeVariants', (select count(*) from public.products where active and shopify_product_id is not null));
  claim := private.claim_shopify_sync_run('manual', null, 90);
  if claim ->> 'resumed' is distinct from 'false' or claim ->> 'pagesProcessed' <> '0' or claim -> 'cursor' <> 'null'::jsonb then raise exception 'Fresh run invariant failed'; end if;
  insert into private.shopify_backfill_operations(operation_id,run_id,identity,baseline)
    values(requested_operation,(claim->>'runId')::uuid,requested_identity,baseline);
  -- Start binds only; source reads require a separately confirmed resume command.
  perform private.pause_shopify_sync_run((claim->>'runId')::uuid,(claim->>'leaseToken')::uuid,'Protected operation admitted; waiting for resume');
  return public.get_shopify_sync_run((claim->>'runId')::uuid) || jsonb_build_object('operationId',requested_operation);
end; $$;

create function public.claim_shopify_backfill_v1(requested_operation uuid, requested_run_id uuid, confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claim jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('snake_shopify_sync', 0));
  if confirmation is distinct from ('RESUME ' || requested_operation || ' ' || requested_run_id)
    or not exists(select 1 from private.shopify_backfill_operations where operation_id=requested_operation and run_id=requested_run_id) then raise exception 'Operation/run approval mismatch'; end if;
  if exists(select 1 from private.sync_runs where id=requested_run_id and (status='completed' or has_next_page=false)) then
    return public.get_shopify_sync_run(requested_run_id) || jsonb_build_object('acquired',false,'completionHold',true);
  end if;
  claim := private.claim_shopify_sync_run('manual',null,90);
  if claim ->> 'runId' is distinct from requested_run_id::text then raise exception 'Bound run mismatch'; end if;
  if claim ->> 'acquired' = 'true' then update private.shopify_backfill_operations set claim_count=claim_count+1 where operation_id=requested_operation; end if;
  return claim;
end; $$;

-- State inspection and pause never expose source credentials.
create function public.recover_shopify_backfill_v1(requested_operation uuid, requested_run_id uuid, confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare state jsonb;
begin
  perform 1 from private.shopify_backfill_operations where operation_id=requested_operation and run_id=requested_run_id for update;
  if not found or confirmation is distinct from ('RESUME ' || requested_operation || ' ' || requested_run_id) then raise exception 'Bound recovery approval required'; end if;
  state:=public.get_shopify_sync_run(requested_run_id);
  update private.shopify_backfill_operations set recovery_reads=recovery_reads+1,
    last_recovered_state=jsonb_build_object('observedAt',clock_timestamp(),'status',state->'status','pagesProcessed',state->'pagesProcessed','cursor',state->'cursor','hasNextPage',state->'hasNextPage') where operation_id=requested_operation;
  return state;
end; $$;

create function public.pause_shopify_backfill_v1(requested_operation uuid, requested_run_id uuid, requested_lease_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from private.shopify_backfill_operations where operation_id=requested_operation and run_id=requested_run_id) then raise exception 'Bound operation required'; end if;
  return private.pause_shopify_sync_run(requested_run_id,requested_lease_token,'Protected pause / final-page completion hold');
end; $$;

create function public.preview_shopify_backfill_v1(requested_operation uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 with scope as (select o.*, r.pages_processed,r.has_next_page,r.status from private.shopify_backfill_operations o join private.sync_runs r on r.id=o.run_id where operation_id=requested_operation),
 affected as (select p.id,p.active,p.shopify_variant_id from public.products p, scope s where p.shopify_variant_id is not null
   and not exists(select 1 from private.sync_run_variants v where v.run_id=s.run_id and v.shopify_variant_id=p.shopify_variant_id))
 select jsonb_build_object('operationId',s.operation_id,'runId',s.run_id,'pagesProcessed',s.pages_processed,
  'ready',not s.has_next_page and s.pages_processed>0 and s.status<>'completed',
  'updatedRows',(select count(*) from affected), 'activeDeactivations',(select count(*) from affected where active),
  'affectedDigest',(select private.backfill_hash(to_jsonb(coalesce(string_agg(id::text || ':' || active::text || ':' || shopify_variant_id, '|' order by id),''))) from affected),
  'examples',(select coalesce(jsonb_agg(to_jsonb(a)), '[]') from (select id,active from affected order by id limit 24) a)) from scope s;
$$;

create function private.backfill_content_fact(product_id text) returns jsonb
language sql stable set search_path = '' set timezone='UTC' as $$
 select jsonb_build_object('shopifyProductId',c.shopify_product_id,'productName',c.product_name,'description',c.description,
  'seoTitle',c.seo_title,'seoDescription',c.seo_description,'productHandle',c.product_handle,'productType',c.product_type,
  'shopifyCategory',case when c.shopify_category_id is null then 'null'::jsonb else jsonb_build_object('id',c.shopify_category_id,'fullName',c.shopify_category_full_name) end,
  'vendor',c.vendor,'status',c.shopify_status,'imageReference',c.image_url,'shopifyUpdatedAt',c.shopify_updated_at,'contentObservedAt',c.content_observed_at)
 from public.shopify_product_content c where c.shopify_product_id=product_id;
$$;
create function private.backfill_member_fact(product_id text) returns jsonb
language sql stable set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.shopify_collection_id,'title',m.title,'handle',m.handle) order by m.shopify_collection_id collate "C"),'[]')
 from public.shopify_product_collections m where m.shopify_product_id=product_id;
$$;
create function private.backfill_variant_fact(variant_id text) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('sku',p.sku,'active',p.active,'productName',p.product_name,'variantName',p.variant_name,
  'productId',p.shopify_product_id,'priceMinor',p.shopify_price_minor,'currency',p.shopify_price_currency,
  'quantity',p.shopify_quantity,'tracked',p.shopify_inventory_tracked,'locationId',p.shopify_inventory_location_id,
  'inventoryItemId',p.shopify_inventory_item_id,'inventoryLevelId',p.shopify_inventory_level_id,
  'status',p.shopify_status,'productType',p.product_type,'vendor',p.vendor,'imageUrl',p.image_url,
  'collections',(select coalesce(jsonb_agg(jsonb_build_object('id',m.shopify_collection_id,'title',m.title,'handle',m.handle) order by m.shopify_collection_id collate "C"),'[]') from public.product_collections m where m.product_id=p.id))
 from public.products p where p.shopify_variant_id=variant_id;
$$;

create function public.apply_shopify_backfill_page_v1(requested_operation uuid, requested_run_id uuid, requested_lease_token uuid,
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
    if not found and nullif(btrim(source->>'sku'),'') is not null then select * into prior from public.products where sku=btrim(source->>'sku'); end if;
    if prior.id is null and nullif(btrim(source->>'sku'),'') is null then
      variant_facts:=variant_facts || jsonb_build_array(jsonb_build_object('variantId',source->>'shopifyVariantId','skipped',true,'digest',null,'priorId',null));
      continue;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',value->>'id','title',value->>'title','handle',nullif(value->>'handle','')) order by value->>'id' collate "C"),'[]') into members from jsonb_array_elements(source->'collections');
    desired:=jsonb_build_object('sku',coalesce(nullif(btrim(source->>'sku'),''),prior.sku),'active',true,'productName',source->>'productName',
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

create function public.complete_shopify_backfill_v1(requested_operation uuid, requested_run_id uuid, approved_preview jsonb, confirmation text)
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
  lock table public.products in share row exclusive mode;
  preview:=public.preview_shopify_backfill_v1(requested_operation);
  if preview->>'ready' is distinct from 'true' or preview is distinct from approved_preview then raise exception 'Reconciliation preview changed or final page not committed'; end if;
  if (select count(*) from private.shopify_backfill_pages where operation_id=requested_operation) is distinct from (preview->>'pagesProcessed')::bigint then raise exception 'Incomplete page provenance'; end if;
  claim:=private.claim_shopify_sync_run('manual',null,90);
  if claim->>'acquired' is distinct from 'true' or claim->>'runId' is distinct from requested_run_id::text then raise exception 'Completion requires reclaimed bound lease'; end if;
  perform private.complete_shopify_sync_run(requested_run_id,(claim->>'leaseToken')::uuid);
  update private.shopify_backfill_operations o set completed_at=clock_timestamp(),approved_preview=complete_shopify_backfill_v1.approved_preview where operation_id=requested_operation;
  return public.get_shopify_sync_run(requested_run_id);
end; $$;

-- No private implementation is callable by API roles. Public control RPCs use
-- the same service-only trust boundary as the existing sync writer.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname like 'backfill_%')
      or (n.nspname='public' and p.proname in ('claim_shopify_sync_run','apply_shopify_sync_page','apply_shopify_sync_page_v2',
        'complete_shopify_sync_run','pause_shopify_sync_run','fail_shopify_sync_run','get_shopify_backfill_plan_v1',
        'start_shopify_backfill_v1','claim_shopify_backfill_v1','recover_shopify_backfill_v1','pause_shopify_backfill_v1','preview_shopify_backfill_v1',
        'apply_shopify_backfill_page_v1','complete_shopify_backfill_v1')) loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.signature);
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('claim_shopify_sync_run','apply_shopify_sync_page','apply_shopify_sync_page_v2','complete_shopify_sync_run',
      'pause_shopify_sync_run','fail_shopify_sync_run','get_shopify_backfill_plan_v1','start_shopify_backfill_v1','claim_shopify_backfill_v1',
      'recover_shopify_backfill_v1','pause_shopify_backfill_v1','preview_shopify_backfill_v1','apply_shopify_backfill_page_v1','complete_shopify_backfill_v1') loop
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end; $$;
