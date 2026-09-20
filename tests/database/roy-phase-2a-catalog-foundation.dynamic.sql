\set ON_ERROR_STOP on
begin;
\ir roy-phase-2a-catalog-foundation.helpers.sql

do $$
declare result jsonb := phase2a_test.read_foundation();
begin
  perform phase2a_test.check(result #>> '{totals,productCount}' = '0' and result #>> '{totals,variantCount}' = '0', 'empty catalog');
  perform phase2a_test.check(result -> 'findings' = '[]'::jsonb, 'no invented findings');
  perform phase2a_test.check(result #> '{freshness,contentObservedAt,oldest}' = 'null'::jsonb, 'no invented timestamp');
  perform phase2a_test.check(result #>> '{fields,description,unknownCount}' = '0', 'empty field populations');
end;
$$;

select phase2a_test.seed_foundation_product(96001, true, true, 2);
select phase2a_test.seed_foundation_product(96002, true, true, 0);
select phase2a_test.seed_foundation_product(96003, true, false, 3);
select phase2a_test.seed_foundation_product(96004, false, false, 0);
select phase2a_test.seed_foundation_product(96005, false, false, 0);
select phase2a_test.seed_foundation_product(96006, true, true, 1);
select phase2a_test.seed_foundation_product(96007, true, true, 1);
delete from public.shopify_product_content where shopify_product_id = 'gid://shopify/Product/96005';
update public.products set active = false where shopify_product_id = 'gid://shopify/Product/96006';
delete from public.products where shopify_product_id = 'gid://shopify/Product/96007';
insert into public.products (product_name, sku, active) values ('Local only', 'CF-LOCAL', true);
insert into public.products (shopify_product_id, shopify_variant_id, product_name, sku, active, synced_at)
values ('gid://shopify/Product/96001', null, 'Sibling label', 'ABC-REPRESENTATIVE', true, null);
update public.products set sku = null where shopify_product_id = 'gid://shopify/Product/96005';
-- Legacy rows and type data must not fill canonical gaps.
update public.products set product_type = 'Legacy type';
insert into public.product_collections (product_id, shopify_collection_id, title)
select id, 'gid://shopify/Collection/999', 'Legacy-only collection'
from public.products where shopify_product_id = 'gid://shopify/Product/96005';
update public.shopify_product_content set shopify_status = 'ARCHIVED'
where shopify_product_id = 'gid://shopify/Product/96001';
update public.shopify_product_content set image_url = null where shopify_product_id = 'gid://shopify/Product/96001';
update public.shopify_product_content set product_type = null where shopify_product_id = 'gid://shopify/Product/96003';
update public.shopify_product_content set description = U&'\00A0\FEFF\0009\2028', seo_title = null, seo_description = '',
  product_type = '', shopify_category_id = null, shopify_category_full_name = null, image_url = null
where shopify_product_id = 'gid://shopify/Product/96002';

do $$
declare
  before_state jsonb := phase2a_test.snapshot();
  result jsonb := phase2a_test.read_foundation();
  field record;
begin
  perform phase2a_test.check(phase2a_test.snapshot() = before_state, 'RPC must not write');
  perform phase2a_test.check(result #>> '{totals,productCount}' = '5' and result #>> '{totals,variantCount}' = '6', 'variant authority and no join multiplication');
  perform phase2a_test.check(result #>> '{contentCoverage,observedProductCount}' = '3' and result #>> '{contentCoverage,unknownProductCount}' = '2', 'observation coverage');
  perform phase2a_test.check(result #>> '{fields,description,missingCount}' = '1' and result #>> '{fields,description,presentCount}' = '2', 'Unicode missing plus observed present');
  perform phase2a_test.check(result #>> '{fields,shopifyCategory,missingCount}' = '1' and result #>> '{fields,productType,missingCount}' = '2', 'independent category and type');
  perform phase2a_test.check(result #>> '{collections,unknownOrIncompleteProductCount}' = '3'
    and result #>> '{collections,completeProductCount}' = '2' and result #>> '{collections,completeWithZeroCollectionsCount}' = '1'
    and result #>> '{collections,completeWithCollectionsCount}' = '1', 'incomplete rows are not complete and zero requires complete');
  perform phase2a_test.check(result #>> '{freshness,variantSyncedAt,timestampCount}' = '5'
    and result #>> '{freshness,variantSyncedAt,populationCount}' = '6', 'variant timestamp population');
  perform phase2a_test.check(result #>> '{freshness,contentObservedAt,timestampCount}' = '3'
    and result #>> '{freshness,collectionsObservedAt,timestampCount}' = '2', 'canonical timestamp populations');
  perform phase2a_test.check((result #>> '{freshness,shopifyUpdatedAt,oldest}')::timestamptz = '2026-09-14T08:00:00Z'
    and (result #>> '{freshness,contentObservedAt,oldest}')::timestamptz = '2026-09-15T09:00:00Z'
    and (result #>> '{freshness,contentPersistedAt,oldest}')::timestamptz = '2026-09-16T10:00:00Z', 'separate timestamps');
  for field in select value from jsonb_each(result -> 'fields') loop
    perform phase2a_test.check((field.value ->> 'unknownCount')::integer + (field.value ->> 'missingCount')::integer
      + (field.value ->> 'presentCount')::integer = 5, 'field partition');
  end loop;
  perform phase2a_test.check((phase2a_test.read_foundation() - 'generatedAt') = (result - 'generatedAt'), 'deterministic result');
  perform phase2a_test.check((phase2a_test.read_foundation('96000000-0000-4000-8000-000000000002') - 'generatedAt') = (result - 'generatedAt'), 'active user sees same authorized catalog');
  perform phase2a_test.check(result::text !~* 'gid://shopify/|Private description|Private SEO|Vendor must not appear|Legacy-only collection', 'no raw content or technical IDs');
  perform phase2a_test.check(exists (
    select 1 from jsonb_array_elements(result -> 'findings') as f(value)
    cross join lateral jsonb_array_elements(f.value -> 'examples') as e(value)
    where e.value ->> 'productLabel' = 'Canonical label 96001'
      and e.value ->> 'representativeSku' = 'ABC-REPRESENTATIVE'
      and e.value ->> 'labelSource' = 'product_content'
  ), 'deterministic representative SKU and observed label provenance');
  perform phase2a_test.check(result ->> 'scopeAuthority' = 'snake_products_active_shopify_linked', 'scope authority explicit');
  perform phase2a_test.check(result -> 'limitations' ? 'Counts describe Snake''s persisted active Shopify-linked catalog, not independently verified live Shopify totals.', 'scope limitation explicit');
end;
$$;

-- The full ECMAScript trim set; the non-whitespace controls/zero-width code
-- points are intentionally PRESENT. These assertions execute real SQL states.
do $$
declare point integer; result jsonb;
begin
  foreach point in array array[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279] loop
    update public.shopify_product_content set description = chr(point) where shopify_product_id = 'gid://shopify/Product/96002';
    result := phase2a_test.read_foundation();
    perform phase2a_test.check(result #>> '{fields,description,missingCount}' = '1', 'trim parity for code point ' || point);
  end loop;
  foreach point in array array[133,6158,8203] loop
    update public.shopify_product_content set description = chr(point) where shopify_product_id = 'gid://shopify/Product/96002';
    result := phase2a_test.read_foundation();
    perform phase2a_test.check(result #>> '{fields,description,missingCount}' = '0', 'not trim whitespace: ' || point);
  end loop;
end;
$$;

do $$
declare rejected boolean; actor text; db_role text; rejected_constraint text; malformed jsonb;
begin
  foreach actor in array array['96000000-0000-4000-8000-000000000003', '96000000-0000-4000-8000-000000000004',
    '96000000-0000-4000-8000-000000000099', ''] loop
    rejected := false;
    begin perform phase2a_test.read_foundation(actor);
    exception when insufficient_privilege then rejected := true;
    end;
    perform phase2a_test.check(rejected, 'warehouse/inactive/missing identity must fail authorization');
  end loop;
  foreach db_role in array array['anon', 'service_role'] loop
    rejected := false;
    begin
      execute format('set local role %I', db_role);
      perform public.get_roy_catalog_foundation_v1();
    exception when insufficient_privilege then rejected := true;
    end;
    reset role;
    perform phase2a_test.check(rejected, 'no RPC grant to ' || db_role);
  end loop;

  -- Final schema: both half-null directions must fail at the named constraint.
  for malformed in select value from jsonb_array_elements(
    '[{"id":null,"name":"Malformed category"},{"id":"gid://shopify/TaxonomyCategory/aa-1","name":null}]') loop
    rejected := false;
    begin
      update public.shopify_product_content set shopify_category_id=malformed->>'id',
        shopify_category_full_name=malformed->>'name' where shopify_product_id='gid://shopify/Product/96001';
    exception when check_violation then
      get stacked diagnostics rejected_constraint = constraint_name;
      perform phase2a_test.check(rejected_constraint='shopify_product_content_category_valid', 'specific category CHECK rejected pair');
      rejected := true;
    end;
    perform phase2a_test.check(rejected, 'half-null category rejected with 23514');
  end loop;
  -- Defensive reader test only: subtransaction rollback restores the constraint
  -- and original data on the exact expected reader error. No persisted weakening.
  rejected := false;
  begin
    alter table public.shopify_product_content drop constraint shopify_product_content_category_valid;
    update public.shopify_product_content set shopify_category_id=null, shopify_category_full_name='Malformed category'
      where shopify_product_id='gid://shopify/Product/96001';
    perform phase2a_test.read_foundation();
  exception when sqlstate '22000' then rejected := true;
  end;
  perform phase2a_test.check(rejected, 'reader defensively rejects malformed category with 22000');
  perform phase2a_test.check(exists(select 1 from pg_constraint where conrelid='public.shopify_product_content'::regclass
    and conname='shopify_product_content_category_valid'), 'reader isolation restored category constraint');
  rejected := false;
  begin
    update public.shopify_product_content set content_observed_at = 'infinity' where shopify_product_id = 'gid://shopify/Product/96001';
    perform phase2a_test.read_foundation();
  exception when sqlstate '22000' then rejected := true;
  end;
  perform phase2a_test.check(rejected, 'nonfinite observations fail closed');
end;
$$;

-- Size and evidence tests use only a fresh synthetic active population.
update public.products set active = false;
do $$
declare i integer; result jsonb; finding record; entry record; before_state jsonb;
begin
  for i in 97001..97040 loop
    perform phase2a_test.seed_foundation_product(i, true, true, 0);
  end loop;
  update public.shopify_product_content set description = '', seo_title = null, seo_description = '',
    product_type = null, shopify_category_id = null, shopify_category_full_name = null, image_url = null
    where shopify_product_id like 'gid://shopify/Product/970%';
  result := phase2a_test.read_foundation();
  perform phase2a_test.check(result #>> '{evidence,returnedExampleCount}' = '24', 'global cap exactly reached');
  perform phase2a_test.check(result #>> '{evidence,truncated}' = 'true' and result #>> '{evidence,budgetLimited}' = 'false', 'allocation truncation');
  for finding in select value from jsonb_array_elements(result -> 'findings') loop
    perform phase2a_test.check(jsonb_array_length(finding.value -> 'examples') <= 8, 'per-finding cap');
    perform phase2a_test.check(finding.value ->> 'affectedProductCount' = '40', 'exact counts despite truncation');
  end loop;

  -- Duplicate human labels remain distinct products internally. Multi-byte
  -- labels push the 24 candidates over 32 KiB and must lose examples, not counts.
  update public.shopify_product_content set product_name = repeat(chr(129520), 300)
    where shopify_product_id like 'gid://shopify/Product/970%';
  update public.products set sku = repeat(chr(129520), 130) || id::text
    where active and shopify_product_id is not null;
  before_state := phase2a_test.snapshot();
  result := phase2a_test.read_foundation();
  perform phase2a_test.check(phase2a_test.snapshot() = before_state, 'budget handling remains read only');
  perform phase2a_test.check(octet_length(convert_to(result::text, 'UTF8')) <= 32768, 'serialized UTF-8 budget');
  perform phase2a_test.check(result #>> '{evidence,budgetLimited}' = 'true'
    and (result #>> '{evidence,returnedExampleCount}')::integer < 24, 'byte budget removes evidence');
  perform phase2a_test.check(result #>> '{totals,productCount}' = '40'
    and result #>> '{fields,description,missingCount}' = '40', 'budget preserves counts');
  for finding in select value from jsonb_array_elements(result -> 'findings') loop
    for entry in select value from jsonb_array_elements(finding.value -> 'examples') loop
      perform phase2a_test.check(length(entry.value ->> 'productLabel') <= 240
        and length(entry.value ->> 'representativeSku') <= 120, 'code point bounds');
      perform phase2a_test.check(entry.value ->> 'labelTruncated' = 'true' and entry.value ->> 'skuTruncated' = 'true', 'label truncation explicit');
    end loop;
  end loop;
  perform phase2a_test.check((phase2a_test.read_foundation() - 'generatedAt') = (result - 'generatedAt'), 'deterministic byte allocation');
  update public.shopify_product_content set product_name = 'GID://SHOPIFY/Product/secret' where shopify_product_id like 'gid://shopify/Product/970%';
  update public.products set product_name = 'gid://shopify/Collection/secret', sku = 'gid://shopify/ProductVariant/' || id::text where active;
  result := phase2a_test.read_foundation();
  perform phase2a_test.check(result::text !~* 'gid://shopify/' and result #>> '{evidence,returnedExampleCount}' = '0', 'unsafe labels cannot leak technical IDs');
  perform phase2a_test.check(result #>> '{totals,productCount}' = '40', 'withheld labels do not alter aggregates');
end;
$$;

rollback;
\echo 'Catalog foundation executable assertions passed; all fixture changes rolled back.'
