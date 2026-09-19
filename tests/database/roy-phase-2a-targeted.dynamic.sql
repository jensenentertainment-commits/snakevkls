\set ON_ERROR_STOP on
begin;
\ir roy-phase-2a-targeted.helpers.sql
select phase2a_test.check(phase2a_test.read_target('ABSENT') ->> 'status' = 'not_found', 'empty catalog is not_found');
select phase2a_test.seed_foundation_product(99001, true, true, 30);
select phase2a_test.seed_foundation_product(99002, true, true, 0);
select phase2a_test.seed_foundation_product(99003, true, false, 3);
select phase2a_test.seed_foundation_product(99004, false, false, 0);
select phase2a_test.seed_foundation_product(99005, true, true, 1);
update public.products set active = false where sku = 'CF-99005';
insert into public.products (product_name, sku, active) values ('Local only', 'LOCAL-1', true);
insert into public.products (shopify_product_id, shopify_variant_id, product_name, sku, active,
  variant_name, shopify_quantity, shopify_price_minor, shopify_price_currency, shopify_inventory_tracked, shopify_inventory_observed_at)
select 'gid://shopify/Product/99001', 'gid://shopify/ProductVariant/' || n, 'Sibling ' || n, 'SIB-' || n,
  true, 'Variant ' || n, 999, 99999, 'NOK', true, '2026-09-19T08:00:00Z'
from generate_series(1, 30) n;
update public.products set variant_name = 'Default Title', shopify_quantity = 3, shopify_price_minor = 12000,
  shopify_price_currency = 'NOK', shopify_inventory_tracked = true, shopify_inventory_observed_at = '2026-09-19T09:00:00Z'
where sku = 'CF-99001';
-- Legacy data cannot fill canonical unknowns.
update public.products set product_type = 'Legacy only' where sku = 'CF-99004';
insert into public.product_collections(product_id, shopify_collection_id, title)
select id, 'gid://shopify/Collection/9999', 'Legacy only' from public.products where sku = 'CF-99004';

do $$
declare r jsonb; before_state jsonb := phase2a_test.snapshot();
begin
  r := phase2a_test.read_target('CF-99001');
  perform phase2a_test.check(phase2a_test.snapshot() = before_state, 'reader performs no writes');
  perform phase2a_test.check(r ->> 'status' = 'found', 'found exact active SKU');
  perform phase2a_test.check(r #>> '{selectedVariant,sku}' = 'CF-99001' and r #>> '{selectedVariant,quantity}' = '3'
    and r #>> '{selectedVariant,priceMinor}' = '12000' and r #> '{selectedVariant,variantName}' = 'null', 'selected variant authority');
  perform phase2a_test.check(r ->> 'variantCount' = '31' and jsonb_array_length(r -> 'siblingVariants') = 24
    and r ->> 'siblingsTruncated' = 'true', 'bounded siblings with exact population');
  perform phase2a_test.check(r #>> '{canonicalCollections,membershipCount}' = '30'
    and jsonb_array_length(r #> '{canonicalCollections,names}') = 24 and r #>> '{canonicalCollections,displayTruncated}' = 'true', 'bounded complete membership');
  perform phase2a_test.check((phase2a_test.read_target('CF-99001') - 'generatedAt') = (r - 'generatedAt'), 'deterministic allocation');
  perform phase2a_test.check((phase2a_test.read_target('CF-99001','96000000-0000-4000-8000-000000000002') - 'generatedAt') = (r - 'generatedAt'), 'active user access');
  perform phase2a_test.check(r::text !~* 'gid://shopify/', 'no technical IDs');
  perform phase2a_test.check(r #>> '{productContent,shopifyUpdatedAt}' <> r #>> '{productContent,contentObservedAt}', 'source and observation distinct');
  r := phase2a_test.read_target('CF-99002');
  perform phase2a_test.check(r #>> '{canonicalCollections,state}' = 'complete' and r #>> '{canonicalCollections,membershipCount}' = '0', 'complete zero');
  r := phase2a_test.read_target('CF-99003');
  perform phase2a_test.check(r #>> '{canonicalCollections,state}' = 'unknown_or_incomplete'
    and r #> '{canonicalCollections,membershipCount}' = 'null' and r #> '{canonicalCollections,names}' = '[]', 'partial rows never canonical');
  r := phase2a_test.read_target('CF-99004');
  perform phase2a_test.check(r #>> '{productContent,fields,productType,state}' = 'unknown'
    and r #> '{productContent,fields,productType,value}' = 'null', 'legacy values do not fill unknown');
  perform phase2a_test.check(phase2a_test.read_target('CF-99005')->>'status' = 'not_found', 'inactive excluded');
  perform phase2a_test.check(phase2a_test.read_target('LOCAL-1')->>'status' = 'not_found', 'local-only excluded');
end;
$$;

-- Exercise fail-closed ambiguity defensively even though deployed SKU indexes
-- normally prevent it. DDL is rolled back to this savepoint immediately.
savepoint duplicate_sku_fixture;
alter table public.products drop constraint if exists products_sku_key;
drop index if exists public.products_sku_unique;
insert into public.products (shopify_product_id, product_name, sku, active)
values ('gid://shopify/Product/99999', 'Ambiguous product', 'CF-99001', true);
select phase2a_test.check(phase2a_test.read_target('CF-99001') ->> 'status' = 'ambiguous', 'never choose first duplicate SKU identity');
select phase2a_test.check(phase2a_test.read_target('CF-99001') -> 'selectedVariant' = 'null', 'ambiguous exposes no selected variant');
rollback to savepoint duplicate_sku_fixture;
release savepoint duplicate_sku_fixture;

delete from public.shopify_product_content where shopify_product_id = 'gid://shopify/Product/99004';
select phase2a_test.check(phase2a_test.read_target('CF-99004') #>> '{productContent,fields,description,state}' = 'unknown', 'absent canonical row is unknown');

-- Exact ECMAScript whitespace classification before previews; non-trim controls
-- remain PRESENT even if their unsafe display text is withheld.
do $$
declare n integer; r jsonb;
begin
  foreach n in array array[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279] loop
    update public.shopify_product_content set description = chr(n) where shopify_product_id = 'gid://shopify/Product/99002';
    perform phase2a_test.check(phase2a_test.read_target('CF-99002') #>> '{productContent,fields,description,state}' = 'missing', 'Unicode missing ' || n);
  end loop;
  foreach n in array array[133,6158,8203] loop
    update public.shopify_product_content set description = chr(n) where shopify_product_id = 'gid://shopify/Product/99002';
    perform phase2a_test.check(phase2a_test.read_target('CF-99002') #>> '{productContent,fields,description,state}' = 'present', 'Unicode present ' || n);
  end loop;
  update public.shopify_product_content set description = repeat(' ', 2048) || 'value', seo_title = null, seo_description = '',
    shopify_category_id = null, shopify_category_full_name = null
  where shopify_product_id = 'gid://shopify/Product/99002';
  r := phase2a_test.read_target('CF-99002');
  perform phase2a_test.check(r #>> '{productContent,fields,description,state}' = 'present'
    and r #>> '{productContent,fields,description,truncated}' = 'true', 'classify full value before truncation');
  perform phase2a_test.check(r #>> '{productContent,fields,seoTitleOverride,state}' = 'missing'
    and r #>> '{productContent,fields,seoDescriptionOverride,state}' = 'missing', 'explicit empty SEO overrides');
  perform phase2a_test.check(r #>> '{productContent,fields,shopifyCategory,state}' = 'missing'
    and r #>> '{productContent,fields,productType,state}' = 'present', 'category separate from type');
end;
$$;

-- Force byte reduction with valid multi-byte values and escaping overhead.
update public.products set product_name = repeat(U&'\+01F9F0', 240), variant_name = repeat(U&'\+01F9F0', 240)
where shopify_product_id = 'gid://shopify/Product/99001';
update public.shopify_product_content set description = repeat(U&'\+01F9F0', 5000)
where shopify_product_id = 'gid://shopify/Product/99001';
do $$
declare r jsonb := phase2a_test.read_target('CF-99001');
begin
  perform phase2a_test.check(octet_length(convert_to(r::text, 'UTF8')) <= 32768 and r ->> 'budgetLimited' = 'true', 'byte cap and explicit budget flag');
  perform phase2a_test.check(r #>> '{selectedVariant,sku}' = 'CF-99001' and r ->> 'variantCount' = '31'
    and r #>> '{canonicalCollections,membershipCount}' = '30', 'selected identity and counts retained under budget');
end;
$$;
update public.shopify_product_content set description = 'gid://shopify/Product/123'
where shopify_product_id = 'gid://shopify/Product/99002';
select phase2a_test.check(phase2a_test.read_target('CF-99002') #>> '{productContent,fields,description,withheld}' = 'true', 'ID-shaped source withheld');

-- Authorization fails rather than returning an RLS-distorted unknown snapshot.
do $$
declare actor text;
begin
  foreach actor in array array['96000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000004','96000000-0000-4000-8000-000000000099'] loop
    begin
      perform phase2a_test.read_target('CF-99001', actor);
      raise exception 'Unauthorized caller accepted';
    exception when insufficient_privilege then null; end;
  end loop;
  perform phase2a_test.check(not has_function_privilege('anon', 'public.get_roy_targeted_product_v1(text)', 'EXECUTE'), 'anon denied');
  perform phase2a_test.check(not has_function_privilege('service_role', 'public.get_roy_targeted_product_v1(text)', 'EXECUTE'), 'no service-role retrieval');
end;
$$;
-- A malformed half-category must fail the response, never PRESENT.
do $$
begin
  begin
    update public.shopify_product_content set shopify_category_id = null, shopify_category_full_name = 'Malformed half category'
    where shopify_product_id = 'gid://shopify/Product/99002';
    perform phase2a_test.read_target('CF-99002');
    raise exception 'Malformed category accepted';
  exception when check_violation or data_exception then null; end;
end;
$$;
rollback;
