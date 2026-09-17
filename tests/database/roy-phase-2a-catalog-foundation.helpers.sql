\set ON_ERROR_STOP on
-- Includes the database-name + explicit opt-in guard before ANY fixture writes.
\ir roy-phase-2a-sync-persistence.helpers.sql
select phase2a_test.check(not exists (select 1 from public.products), 'fresh disposable migrated database required');
select phase2a_test.check(not exists (select 1 from public.shopify_product_content), 'empty canonical tables required');

insert into auth.users (id) values
  ('96000000-0000-4000-8000-000000000001'), ('96000000-0000-4000-8000-000000000002'),
  ('96000000-0000-4000-8000-000000000003'), ('96000000-0000-4000-8000-000000000004');
insert into public.profiles (id, email, role, display_name, active) values
  ('96000000-0000-4000-8000-000000000001', 'admin@foundation.test', 'admin', 'Foundation admin', true),
  ('96000000-0000-4000-8000-000000000002', 'user@foundation.test', 'user', 'Foundation user', true),
  ('96000000-0000-4000-8000-000000000003', 'warehouse@foundation.test', 'warehouse', 'Warehouse', true),
  ('96000000-0000-4000-8000-000000000004', 'inactive@foundation.test', 'admin', 'Inactive', false);

create function phase2a_test.read_foundation(actor text default '96000000-0000-4000-8000-000000000001')
returns jsonb language plpgsql as $$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.sub', actor, true);
  set local role authenticated;
  result := public.get_roy_catalog_foundation_v1();
  reset role;
  return result;
exception when others then
  reset role;
  raise;
end;
$$;

create function phase2a_test.seed_foundation_product(product_number integer, observed boolean, complete boolean, members integer)
returns void language plpgsql as $$
declare product_id text := 'gid://shopify/Product/' || product_number;
begin
  insert into public.products (shopify_product_id, shopify_variant_id, product_name, sku, active, synced_at)
  values (product_id, 'gid://shopify/ProductVariant/' || product_number, 'Variant label ' || product_number,
    'CF-' || product_number, true, '2026-09-16T11:00:00Z');
  if observed then
    insert into public.shopify_product_content (
      shopify_product_id, product_name, description, seo_title, seo_description, product_handle,
      product_type, shopify_category_id, shopify_category_full_name, image_url, vendor, shopify_status,
      shopify_updated_at, content_observed_at, synced_at, collections_complete, collections_observed_at
    ) values (
      product_id, 'Canonical label ' || product_number, 'Private description', 'Private SEO', 'Private SEO body', 'handle-' || product_number,
      'Merchant type', 'gid://shopify/TaxonomyCategory/aa-1', 'Taxonomy > Path', 'https://example.test/image', 'Vendor must not appear', 'ACTIVE',
      '2026-09-14T08:00:00Z', '2026-09-15T09:00:00Z', '2026-09-16T10:00:00Z', complete,
      case when complete then '2026-09-15T09:05:00Z'::timestamptz else null end
    );
  else
    insert into public.shopify_product_content (shopify_product_id) values (product_id);
  end if;
  insert into public.shopify_product_collections (shopify_product_id, shopify_collection_id, title, handle)
  select product_id, 'gid://shopify/Collection/' || n, 'Collection ' || n, 'collection-' || n
  from generate_series(1, members) as n;
end;
$$;
