\set ON_ERROR_STOP on

-- Every entry point includes this guard BEFORE writing. This is not a target
-- provisioning script. An operator must supply an already isolated database.
do $$
begin
  if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$'
    or current_setting('snake.phase2a_isolated', true) is distinct from 'on'
  then
    raise exception 'Isolated snake_phase2a_test database and explicit opt-in required';
  end if;
end;
$$;

create schema phase2a_test;
revoke all on schema phase2a_test from public;

create function phase2a_test.check(ok boolean, message text) returns void
language plpgsql as $$
begin
  if ok is not true then raise exception 'ASSERTION: %', message; end if;
end;
$$;

create function phase2a_test.members() returns jsonb language sql as $$
  select '[{"id":"gid://shopify/Collection/91001","title":"Fixture collection","handle":"fixture"}]'::jsonb;
$$;

create function phase2a_test.product(id integer, members jsonb default phase2a_test.members())
returns jsonb language sql as $$
  select jsonb_build_object(
    'productContent', jsonb_build_object(
      'shopifyProductId', 'gid://shopify/Product/' || id,
      'productName', 'Fixture product', 'description', 'Original description',
      'seoTitle', 'Original SEO', 'seoDescription', 'Original SEO description',
      'productHandle', 'reassigned-handle', 'productType', 'Original type',
      'shopifyCategory', jsonb_build_object('id', 'gid://shopify/TaxonomyCategory/aa-1', 'fullName', 'Original category'),
      'vendor', 'Original vendor', 'status', 'ACTIVE', 'imageReference', 'https://example.test/image.png',
      'shopifyUpdatedAt', '2026-09-15T10:00:00Z', 'contentObservedAt', '2026-09-16T10:00:00Z'
    ),
    'collectionObservation', jsonb_build_object(
      'state', 'complete', 'observedAt', '2026-09-16T10:01:00Z', 'collections', members
    )
  );
$$;

create function phase2a_test.variant(id integer, product_id integer, sku text,
  members jsonb default phase2a_test.members()) returns jsonb language sql as $$
  select jsonb_build_object(
    'shopifyVariantId', 'gid://shopify/ProductVariant/' || id,
    'shopifyProductId', 'gid://shopify/Product/' || product_id,
    'shopifyInventoryItemId', 'gid://shopify/InventoryItem/' || id,
    'sku', sku, 'productName', 'Fixture product', 'variantName', 'Variant ' || id,
    'imageUrl', 'https://example.test/image.png', 'vendor', 'Original vendor', 'productType', 'Original type',
    'shopifyStatus', 'ACTIVE', 'shopifyQuantity', 7,
    'shopifyPriceMinor', 12345, 'shopifyPriceCurrency', 'NOK',
    'shopifyInventoryTracked', true, 'shopifyInventoryLevelId', 'gid://shopify/InventoryLevel/' || id,
    'shopifyInventoryLocationId', 'gid://shopify/Location/91001', 'collections', members
  );
$$;

-- Includes ALL page-side effects, including inventory which must not change.
create function phase2a_test.snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'content', (select coalesce(jsonb_agg(to_jsonb(t) order by shopify_product_id), '[]') from public.shopify_product_content t),
    'canonical', (select coalesce(jsonb_agg(to_jsonb(t) order by shopify_product_id, shopify_collection_id), '[]') from public.shopify_product_collections t),
    'variants', (select coalesce(jsonb_agg(to_jsonb(t) order by id), '[]') from public.products t),
    'legacy', (select coalesce(jsonb_agg(to_jsonb(t) order by product_id, shopify_collection_id), '[]') from public.product_collections t),
    'seen', (select coalesce(jsonb_agg(to_jsonb(t) order by run_id, shopify_variant_id), '[]') from private.sync_run_variants t),
    'runs', (select coalesce(jsonb_agg(to_jsonb(t) order by id), '[]') from private.sync_runs t),
    'inventory', (select coalesce(jsonb_agg(to_jsonb(t) order by id), '[]') from public.inventory t)
  );
$$;

create function phase2a_test.reject_page(
  run_id uuid, token uuid, cursor text, pages integer, next_cursor text, has_next boolean,
  variants jsonb, products jsonb, expected_error text
) returns void language plpgsql as $$
declare
  before_state jsonb := phase2a_test.snapshot();
  rejected boolean := false;
begin
  begin
    perform public.apply_shopify_sync_page_v2(run_id, token, cursor, pages, next_cursor, has_next, variants, products);
  exception when others then
    rejected := true;
    perform phase2a_test.check(position(expected_error in sqlerrm) > 0, 'unexpected rejection: ' || sqlerrm);
  end;
  perform phase2a_test.check(rejected, 'page must reject: ' || expected_error);
  perform phase2a_test.check(phase2a_test.snapshot() = before_state, 'failed page changed persisted state');
end;
$$;

-- Fault injection occurs inside the real database transaction, never a mock.
create function phase2a_test.inject_fault() returns trigger language plpgsql as $$
begin
  if current_setting('snake.phase2a_fault', true) = tg_table_schema || '.' || tg_table_name then
    raise exception 'fixture injected failure at %', tg_table_name;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
