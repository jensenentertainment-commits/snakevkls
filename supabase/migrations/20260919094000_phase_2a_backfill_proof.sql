-- Restricted operator oracle. Independently queries facts; never calls a Roy RPC.
create function public.get_shopify_backfill_proof_facts_v1(requested_operation uuid)
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
revoke all on function public.get_shopify_backfill_proof_facts_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_shopify_backfill_proof_facts_v1(uuid) to service_role;
