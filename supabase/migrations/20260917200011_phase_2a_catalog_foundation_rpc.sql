-- Inactive Roy Phase 2A foundation. No runtime connection, writes or backfill.
create function public.get_roy_catalog_foundation_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
set timezone = 'UTC'
as $$
declare
  -- ECMAScript String.trim WhiteSpace + LineTerminator code points. Deliberately
  -- excludes U+0085, U+180E and U+200B; locale-dependent SQL \s is not equivalent.
  trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  result jsonb;
  candidates jsonb;
  invalid_observation boolean;
  candidate jsonb;
  proposed jsonb;
  finding_index integer;
  examples jsonb;
begin
  -- Warehouse users can read variants but not canonical content. Deny them
  -- explicitly instead of interpreting RLS-hidden observations as UNKNOWN.
  if (select private.has_role(array['admin', 'user']::text[])) is not true then
    raise exception using errcode = '42501', message = 'Roy catalog foundation requires an active admin or user';
  end if;

  with active_variants as materialized (
    select p.id, p.shopify_product_id, p.product_name, p.sku, p.synced_at
    from public.products as p
    where p.active = true and p.shopify_product_id is not null
  ), population as (
    select v.shopify_product_id, count(*) as variant_count
    from active_variants as v group by v.shopify_product_id
  ), representatives as (
    select distinct on (v.shopify_product_id collate "C")
      v.shopify_product_id, v.product_name, v.sku
    from active_variants as v
    order by v.shopify_product_id collate "C",
      (nullif(btrim(v.sku, trim_chars), '') is null), v.sku collate "C" nulls last, v.id
  ), membership_counts as (
    select m.shopify_product_id, count(*) as membership_count
    from public.shopify_product_collections as m
    join population as p on p.shopify_product_id = m.shopify_product_id
    group by m.shopify_product_id
  ), products as materialized (
    select p.shopify_product_id, p.variant_count,
      c.content_observed_at is not null as observed,
      coalesce(c.collections_complete, false) as complete,
      coalesce(m.membership_count, 0) as membership_count,
      c.product_name, c.description, c.seo_title, c.seo_description,
      c.product_handle, c.product_type, c.image_url,
      c.shopify_category_id, c.shopify_category_full_name,
      c.content_observed_at, c.collections_observed_at, c.shopify_updated_at, c.synced_at,
      r.product_name as variant_label, r.sku
    from population as p
    join representatives as r on r.shopify_product_id = p.shopify_product_id
    left join public.shopify_product_content as c on c.shopify_product_id = p.shopify_product_id
    left join membership_counts as m on m.shopify_product_id = p.shopify_product_id
  ), field_definitions(field, finding_code, finding_order) as (
    values ('productName', 'missing_product_name', 2), ('description', 'missing_description', 3),
      ('seoTitle', 'missing_seo_title', 4), ('seoDescription', 'missing_seo_description', 5),
      ('productHandle', 'missing_product_handle', 6), ('productType', 'missing_product_type', 7),
      ('shopifyCategory', 'missing_shopify_category', 8), ('imageReference', 'missing_image_reference', 9)
  ), field_states as materialized (
    select p.shopify_product_id, f.field,
      case when not p.observed then 'unknown'
        when nullif(btrim(f.value, trim_chars), '') is null then 'missing'
        else 'present' end as state
    from products as p
    cross join lateral (values
      ('productName', p.product_name), ('description', p.description),
      ('seoTitle', p.seo_title), ('seoDescription', p.seo_description),
      ('productHandle', p.product_handle), ('productType', p.product_type),
      ('shopifyCategory', p.shopify_category_full_name), ('imageReference', p.image_url)
    ) as f(field, value)
  ), field_counts as (
    select d.field, jsonb_build_object(
      'unknownCount', count(*) filter (where s.state = 'unknown'),
      'missingCount', count(*) filter (where s.state = 'missing'),
      'presentCount', count(*) filter (where s.state = 'present')
    ) as counts
    from field_definitions as d left join field_states as s on s.field = d.field
    group by d.field
  ), finding_definitions(code, finding_order) as (
    select d.finding_code, d.finding_order from field_definitions as d
    union all values ('content_unknown', 1), ('collections_unknown_or_incomplete', 10), ('collections_complete_zero', 11)
  ), matches as materialized (
    select p.shopify_product_id, 'content_unknown'::text as code from products as p where not p.observed
    union all
    select s.shopify_product_id, d.finding_code from field_states as s
      join field_definitions as d on d.field = s.field where s.state = 'missing'
    union all
    select p.shopify_product_id, 'collections_unknown_or_incomplete' from products as p where not p.complete
    union all
    select p.shopify_product_id, 'collections_complete_zero' from products as p where p.complete and p.membership_count = 0
  ), finding_counts as (
    select d.code, d.finding_order, count(*) as affected
    from matches as m join finding_definitions as d on d.code = m.code
    group by d.code, d.finding_order
  ), labels as (
    select p.shopify_product_id,
      case when p.observed and nullif(btrim(p.product_name, trim_chars), '') is not null
        and p.product_name !~* 'gid://shopify/' then p.product_name
        when nullif(btrim(p.variant_label, trim_chars), '') is not null
        and p.variant_label !~* 'gid://shopify/' then p.variant_label end as label,
      case when p.observed and nullif(btrim(p.product_name, trim_chars), '') is not null
        and p.product_name !~* 'gid://shopify/' then 'product_content' else 'variant' end as label_source,
      case when p.sku !~* 'gid://shopify/' then p.sku end as sku
    from products as p
  ), clean_labels as (
    select l.shopify_product_id, l.label_source,
      nullif(btrim(regexp_replace(l.label, U&'[\0001-\001F\007F-\009F]', ' ', 'g'), trim_chars), '') as label,
      nullif(btrim(regexp_replace(l.sku, U&'[\0001-\001F\007F-\009F]', ' ', 'g'), trim_chars), '') as sku
    from labels as l
  ), ranked_examples as (
    select m.code, d.finding_order,
      row_number() over (partition by m.code order by m.shopify_product_id collate "C") as example_rank,
      jsonb_build_object(
        'productLabel', left(l.label, 240), 'labelSource', l.label_source,
        'representativeSku', left(l.sku, 120),
        'labelTruncated', length(l.label) > 240, 'skuTruncated', coalesce(length(l.sku) > 120, false)
      ) as example
    from matches as m join finding_definitions as d on d.code = m.code
    join clean_labels as l on l.shopify_product_id = m.shopify_product_id
    where l.label is not null
  ), allocated_examples as (
    -- Round-robin over fixed finding order, not a quality/severity ranking.
    select e.code, e.example, e.example_rank, e.finding_order from ranked_examples as e
    where e.example_rank <= 8 order by e.example_rank, e.finding_order limit 24
  ), timestamp_values(kind, population_unit, population_count, timestamp_value) as (
    select 'variantSyncedAt', 'variant', (select count(*) from active_variants), v.synced_at from active_variants as v
    union all
    select t.kind, 'product', (select count(*) from products), t.value from products as p
    cross join lateral (values
      ('contentObservedAt', case when p.observed then p.content_observed_at end),
      ('collectionsObservedAt', case when p.complete then p.collections_observed_at end),
      ('shopifyUpdatedAt', case when p.observed then p.shopify_updated_at end),
      ('contentPersistedAt', case when p.observed then p.synced_at end)
    ) as t(kind, value)
  ), timestamp_definitions(kind, unit, population_count) as (
    select 'variantSyncedAt', 'variant', count(*) from active_variants
    union all
    select d.kind, 'product', (select count(*) from products)
    from (values ('contentObservedAt'), ('collectionsObservedAt'), ('shopifyUpdatedAt'), ('contentPersistedAt')) as d(kind)
  ), freshness as (
    select d.kind, jsonb_build_object(
      'populationUnit', d.unit, 'populationCount', d.population_count,
      'timestampCount', count(t.timestamp_value),
      'oldest', min(t.timestamp_value), 'newest', max(t.timestamp_value)
    ) as value from timestamp_definitions as d
    left join timestamp_values as t on t.kind = d.kind
    group by d.kind, d.unit, d.population_count
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'scope', 'active_shopify_products',
    'scopeAuthority', 'snake_products_active_shopify_linked',
    'generatedAt', statement_timestamp(),
    'totals', jsonb_build_object('productCount', (select count(*) from products), 'variantCount', (select count(*) from active_variants)),
    'contentCoverage', jsonb_build_object(
      'observedProductCount', (select count(*) from products where observed),
      'unknownProductCount', (select count(*) from products where not observed)),
    'fields', (select jsonb_object_agg(field, counts) from field_counts),
    'collections', jsonb_build_object(
      'unknownOrIncompleteProductCount', (select count(*) from products where not complete),
      'completeProductCount', (select count(*) from products where complete),
      'completeWithZeroCollectionsCount', (select count(*) from products where complete and membership_count = 0),
      'completeWithCollectionsCount', (select count(*) from products where complete and membership_count > 0)),
    'freshness', (select jsonb_object_agg(kind, value) from freshness),
    'findings', (select coalesce(jsonb_agg(jsonb_build_object(
      'code', code, 'scope', 'product', 'affectedProductCount', affected,
      'examples', '[]'::jsonb, 'examplesTruncated', true
    ) order by finding_order), '[]'::jsonb) from finding_counts),
    'evidence', jsonb_build_object('returnedExampleCount', 0, 'truncated', exists(select 1 from finding_counts), 'budgetLimited', false),
    'limits', jsonb_build_object('maxExamplesPerFinding', 8, 'maxExamplesTotal', 24,
      'maxResponseBytes', 32768, 'maxProductLabelCharacters', 240, 'maxSkuCharacters', 120),
    'limitations', jsonb_build_array(
      'Counts describe Snake''s persisted active Shopify-linked catalog, not independently verified live Shopify totals.',
      'Canonical-only products are excluded; products.active and non-null Shopify product identity define scope.',
      'Observations are last committed snapshots, not the outcome of the latest refresh attempt.',
      'Presence is not quality, correctness or relevance.',
      'Freshness is descriptive; no stale threshold is defined.',
      'Catalog observations may span sync pages and observation times.'
    )
  ),
  (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'example', example)
    order by example_rank, finding_order), '[]'::jsonb) from allocated_examples),
  exists (
    select 1 from products as p where
      (p.observed and (
        p.product_name is null or p.description is null or p.product_handle is null
        or p.shopify_updated_at is null or p.synced_at is null
        or not isfinite(p.content_observed_at) or not isfinite(p.shopify_updated_at) or not isfinite(p.synced_at)
        or ((p.shopify_category_id is null and p.shopify_category_full_name is null)
          or (p.shopify_category_id ~ '^gid://shopify/TaxonomyCategory/[A-Za-z0-9_-]+$'
            and nullif(btrim(p.shopify_category_full_name, trim_chars), '') is not null)) is not true
      )) or (p.complete and (p.collections_observed_at is null or not isfinite(p.collections_observed_at)))
  ) or exists (select 1 from active_variants where synced_at is not null and not isfinite(synced_at))
  into result, candidates, invalid_observation;

  if invalid_observation then
    raise exception using errcode = '22000', message = 'Invalid canonical catalog observation';
  end if;

  -- Only the bounded candidate JSON is held in PL/pgSQL. No catalog row loop.
  for candidate in select value from jsonb_array_elements(candidates)
  loop
    select (ordinality - 1)::integer into finding_index
    from jsonb_array_elements(result -> 'findings') with ordinality as f(value, ordinality)
    where f.value ->> 'code' = candidate ->> 'code';
    examples := (result #> array['findings', finding_index::text, 'examples']) || jsonb_build_array(candidate -> 'example');
    proposed := jsonb_set(result, array['findings', finding_index::text, 'examples'], examples);
    proposed := jsonb_set(proposed, array['findings', finding_index::text, 'examplesTruncated'],
      to_jsonb(jsonb_array_length(examples) < (result #>> array['findings', finding_index::text, 'affectedProductCount'])::bigint));
    proposed := jsonb_set(proposed, '{evidence,returnedExampleCount}', to_jsonb((result #>> '{evidence,returnedExampleCount}')::integer + 1));
    proposed := jsonb_set(proposed, '{evidence,truncated}', to_jsonb(exists (
      select 1 from jsonb_array_elements(proposed -> 'findings') as f(value)
      where (f.value ->> 'examplesTruncated')::boolean
    )));
    if octet_length(convert_to(proposed::text, 'UTF8')) <= 32768 then
      result := proposed;
    else
      result := jsonb_set(result, '{evidence,budgetLimited}', 'true');
    end if;
  end loop;
  result := jsonb_set(result, '{evidence,truncated}', to_jsonb(exists (
    select 1 from jsonb_array_elements(result -> 'findings') as f(value)
    where (f.value ->> 'examplesTruncated')::boolean
  )));
  if octet_length(convert_to(result::text, 'UTF8')) > 32768 then
    raise exception using errcode = '54000', message = 'Catalog foundation response exceeds byte budget';
  end if;
  return result;
end;
$$;

revoke all on function public.get_roy_catalog_foundation_v1() from public, anon, authenticated, service_role;
grant execute on function public.get_roy_catalog_foundation_v1() to authenticated;
