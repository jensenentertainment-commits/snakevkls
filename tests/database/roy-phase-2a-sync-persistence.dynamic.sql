\set ON_ERROR_STOP on
begin;
\ir roy-phase-2a-sync-persistence.helpers.sql

select phase2a_test.check(not exists (select 1 from private.sync_runs), 'use an empty disposable migrated database');
select phase2a_test.check(not exists (select 1 from public.products), 'fixture requires no catalog rows');

create trigger phase2a_fault_content before insert or update on public.shopify_product_content
for each row execute function phase2a_test.inject_fault();
create trigger phase2a_fault_membership after delete on public.shopify_product_collections
for each row execute function phase2a_test.inject_fault();
create trigger phase2a_fault_variant before insert or update on public.products
for each row execute function phase2a_test.inject_fault();
create trigger phase2a_fault_legacy before insert on public.product_collections
for each row execute function phase2a_test.inject_fault();
create trigger phase2a_fault_seen before insert on private.sync_run_variants
for each row execute function phase2a_test.inject_fault();
create trigger phase2a_fault_checkpoint before update on private.sync_runs
for each row execute function phase2a_test.inject_fault();

do $$
declare
  claim jsonb := public.claim_shopify_sync_run('manual', 'phase2a@example.test', 300);
  run_id uuid := (claim ->> 'runId')::uuid;
  token uuid := (claim ->> 'leaseToken')::uuid;
  variants jsonb := jsonb_build_array(
    phase2a_test.variant(91001, 91001, 'PHASE2A-1'),
    phase2a_test.variant(91002, 91001, 'PHASE2A-2'),
    phase2a_test.variant(91003, 91002, null)
  );
  products jsonb := jsonb_build_array(phase2a_test.product(91001), phase2a_test.product(91002));
  result jsonb;
  changed jsonb;
  canonical_before jsonb;
  local_id uuid;
  fault text;
  state text;
begin
  perform phase2a_test.check(claim ->> 'hasNextPage' = 'true', 'fresh claim returns next-page flag');
  perform phase2a_test.check(public.claim_shopify_sync_run('manual') ->> 'hasNextPage' = 'true', 'busy claim includes flag');

  -- Execute successful writer as its only authorized API role.
  set local role service_role;
  result := public.apply_shopify_sync_page_v2(run_id, token, null, 0, 'page-1', true, variants, products, 300);
  reset role;
  perform phase2a_test.check(result ->> 'pagesProcessed' = '1', 'page checkpoint');
  perform phase2a_test.check(result ->> 'processedCount' = '2' and result ->> 'skippedNoSku' = '1', 'unchanged variant counters');
  perform phase2a_test.check(result ->> 'collectionsLinked' = '2', 'legacy collection counter is per variant');
  perform phase2a_test.check((select count(*) = 2 from public.shopify_product_content), 'one canonical row per product including no-SKU product');
  perform phase2a_test.check((select count(*) = 2 from public.shopify_product_collections), 'one relation per product/collection');
  perform phase2a_test.check((select count(*) = 2 from public.product_collections), 'legacy relations preserved per variant');
  perform phase2a_test.check((select count(*) = 3 from private.sync_run_variants), 'skipped variants still seen');
  perform phase2a_test.check((select count(*) = 2 from public.shopify_product_content where product_handle = 'reassigned-handle'), 'handle reassignment is non-unique');
  perform phase2a_test.check((select bool_and(shopify_updated_at = '2026-09-15T10:00:00Z'::timestamptz
    and content_observed_at = '2026-09-16T10:00:00Z'::timestamptz and synced_at <> shopify_updated_at
    and collections_complete) from public.shopify_product_content), 'three separate timestamps and complete membership');
  select id into local_id from public.products where shopify_variant_id = 'gid://shopify/ProductVariant/91001';
  insert into public.zones (id, code, name, pick_priority) values ('91000000-0000-4000-8000-000000000010', 'P2A', 'Fixture', 100);
  insert into public.locations (id, code, zone_id) values ('91000000-0000-4000-8000-000000000011', 'P2A-1', '91000000-0000-4000-8000-000000000010');
  insert into public.inventory (id, product_id, location_id, zone_id, quantity, is_primary) values (
    '91000000-0000-4000-8000-000000000012', local_id, '91000000-0000-4000-8000-000000000011',
    '91000000-0000-4000-8000-000000000010', 23, true);

  -- Replay protection: correct cursor but stale page count, and stale cursor.
  perform phase2a_test.reject_page(run_id, token, 'page-1', 0, 'page-2', true, variants, products, 'checkpoint conflict');
  perform phase2a_test.reject_page(run_id, token, null, 1, 'page-2', true, variants, products, 'checkpoint conflict');
  perform phase2a_test.reject_page(run_id, gen_random_uuid(), 'page-1', 1, 'page-2', true, variants, products, 'lease is not valid');
  perform phase2a_test.reject_page(run_id, null, 'page-1', 1, 'page-2', true, variants, products, 'lease is not valid');
  perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-1', true, variants, products, 'page progress');
  perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, '[]', '[]', 'page progress');

  foreach state in array array['unknown', 'incomplete'] loop
    changed := jsonb_set(products, '{0,collectionObservation,state}', to_jsonb(state));
    perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, variants, changed, 'Only complete');
  end loop;
  changed := products #- '{0,productContent,seoTitle}';
  perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, variants, changed, 'missing required fields');
  changed := jsonb_set(products, '{0,productContent,shopifyUpdatedAt}', '"not-a-date"');
  perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, variants, changed, 'timestamp');
  changed := products || jsonb_build_array(products -> 0);
  perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, variants, changed, 'duplicate Shopify product');
  changed := jsonb_set(products, '{0,collectionObservation,collections}', phase2a_test.members() || phase2a_test.members());
  perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, variants, changed, 'Duplicate canonical');
  changed := jsonb_set(variants, '{0,collections}', '[]');
  perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, changed, products, 'membership disagree');
  perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, variants || jsonb_build_array(variants -> 0), products, 'Duplicate Shopify variant');
  -- Legacy error occurs AFTER canonical replacement, proving nested rollback.
  changed := jsonb_set(variants, '{1,shopifyPriceMinor}', '-1');
  perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, changed, products, 'invalid price');

  foreach fault in array array['public.shopify_product_content', 'public.shopify_product_collections',
    'private.sync_run_variants', 'public.products', 'public.product_collections', 'private.sync_runs'] loop
    perform set_config('snake.phase2a_fault', fault, true);
    perform phase2a_test.reject_page(run_id, token, 'page-1', 1, 'page-2', true, variants,
      jsonb_set(products, '{0,productContent,description}', '"Must roll back"'), 'fixture injected failure');
  end loop;
  perform set_config('snake.phase2a_fault', '', true);

  -- All explicit missing content replaces the previous observed values.
  changed := jsonb_set(products, '{0,productContent}', (products #> '{0,productContent}') ||
    '{"description":"","seoTitle":null,"seoDescription":"","productType":null,"shopifyCategory":null,"vendor":"","imageReference":null}'::jsonb);
  changed := jsonb_set(changed, '{0,collectionObservation,collections}', '[]');
  variants := jsonb_set(jsonb_set(variants, '{0,collections}', '[]'), '{1,collections}', '[]');
  -- Existing variant without SKU keeps its established local identity and SKU.
  variants := jsonb_set(variants, '{0,sku}', 'null');
  result := public.apply_shopify_sync_page_v2(run_id, token, 'page-1', 1, 'page-2', true, variants, changed, 300);
  perform phase2a_test.check((select collections_complete and description = '' and seo_title is null and seo_description = ''
    and product_type is null and shopify_category_id is null and shopify_category_full_name is null
    and vendor = '' and image_url is null from public.shopify_product_content where shopify_product_id = 'gid://shopify/Product/91001'), 'observed missing values overwrite');
  perform phase2a_test.check(not exists (select 1 from public.shopify_product_collections where shopify_product_id = 'gid://shopify/Product/91001'), 'complete empty replaces old canonical rows');
  perform phase2a_test.check(not exists (select 1 from public.product_collections), 'complete empty also preserves legacy replacement semantics');
  perform phase2a_test.check((select id = local_id and sku = 'PHASE2A-1' and shopify_price_minor = 12345 and shopify_quantity = 7
    from public.products where shopify_variant_id = 'gid://shopify/ProductVariant/91001'), 'variant identity SKU price inventory preserved');
  perform phase2a_test.check((select quantity = 23 and product_id = local_id from public.inventory
    where id = '91000000-0000-4000-8000-000000000012'), 'physical inventory and local FK unchanged');
  perform phase2a_test.check(result ->> 'processedCount' = '4' and result ->> 'skippedNoSku' = '2'
    and result ->> 'collectionsLinked' = '2', 'existing counter accumulation');

  -- A failed refresh of a complete-empty snapshot must keep it complete-empty.
  perform phase2a_test.reject_page(run_id, token, 'page-2', 2, 'page-3', true, variants,
    jsonb_set(changed, '{0,collectionObservation,state}', '"incomplete"'), 'Only complete');

  -- Paused reclaim retains checkpoint and invalidates the previous lease.
  perform public.pause_shopify_sync_run(run_id, token, 'fixture pause');
  claim := public.claim_shopify_sync_run('manual', 'phase2a@example.test', 300);
  perform phase2a_test.check((claim ->> 'runId')::uuid = run_id and claim ->> 'pagesProcessed' = '2'
    and claim ->> 'hasNextPage' = 'true', 'resume persisted checkpoint');
  perform phase2a_test.reject_page(run_id, token, 'page-2', 2, 'page-3', true, variants, changed, 'lease is not valid');
  token := (claim ->> 'leaseToken')::uuid;
  update private.sync_runs set lease_expires_at = now() - interval '1 second' where id = run_id;
  perform phase2a_test.reject_page(run_id, token, 'page-2', 2, 'page-3', true, variants, changed, 'lease is not valid');
  claim := public.claim_shopify_sync_run('manual', 'phase2a@example.test', 300);
  token := (claim ->> 'leaseToken')::uuid;

  -- Empty final page with a null cursor cannot be replayed (page count + flag).
  result := public.apply_shopify_sync_page_v2(run_id, token, 'page-2', 2, null, false, '[]', '[]', 300);
  perform phase2a_test.check(result ->> 'hasNextPage' = 'false', 'final page persisted');
  perform phase2a_test.reject_page(run_id, token, null, 3, null, false, '[]', '[]', 'checkpoint conflict');
  perform phase2a_test.check(public.claim_shopify_sync_run('manual') ->> 'hasNextPage' = 'false', 'busy final-page claim');
  update private.sync_runs set lease_expires_at = now() - interval '1 second' where id = run_id;
  claim := public.claim_shopify_sync_run('manual', 'phase2a@example.test', 300);
  perform phase2a_test.check(claim ->> 'hasNextPage' = 'false' and claim ->> 'pagesProcessed' = '3', 'final-page recovery claim');
  perform public.complete_shopify_sync_run(run_id, (claim ->> 'leaseToken')::uuid);
  perform phase2a_test.check(public.get_shopify_sync_run(run_id) ->> 'status' = 'completed', 'authoritative completion');

  -- Old writer remains callable and must never fabricate canonical coverage.
  claim := public.claim_shopify_sync_run('manual', 'old-writer@example.test', 300);
  run_id := (claim ->> 'runId')::uuid;
  token := (claim ->> 'leaseToken')::uuid;
  canonical_before := phase2a_test.snapshot() -> 'content';
  perform public.apply_shopify_sync_page(run_id, token, null, 'old-page', true,
    jsonb_build_array(phase2a_test.variant(91004, 91004, 'OLD-WRITER')), 300);
  perform phase2a_test.check(phase2a_test.snapshot() -> 'content' = canonical_before, 'old pages remain UNKNOWN');
  perform public.pause_shopify_sync_run(run_id, token, 'old writer rollout');
  claim := public.claim_shopify_sync_run('manual', 'new-writer@example.test', 300);
  perform phase2a_test.check(claim ->> 'pagesProcessed' = '1' and claim ->> 'cursor' = 'old-page', 'no checkpoint reset at rollout');
  perform public.apply_shopify_sync_page_v2(run_id, (claim ->> 'leaseToken')::uuid, 'old-page', 1, 'new-page', false,
    jsonb_build_array(phase2a_test.variant(91005, 91005, 'NEW-WRITER')), jsonb_build_array(phase2a_test.product(91005)), 300);
  perform phase2a_test.check(not exists (select 1 from public.shopify_product_content where shopify_product_id = 'gid://shopify/Product/91004'), 'no backfill of prior page');
end;
$$;

-- Executable authorization checks: invoker denial and inherited table RLS.
do $$
declare
  denied boolean;
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    denied := false;
    begin
      execute format('set local role %I', role_name);
      perform public.apply_shopify_sync_page_v2(null, null, null, 0, null, false, '[]', '[]');
    exception when insufficient_privilege then denied := true;
    end;
    reset role;
    perform phase2a_test.check(denied, role_name || ' must not execute v2');
    perform phase2a_test.check(not has_table_privilege(role_name, 'public.shopify_product_content', 'INSERT,UPDATE,DELETE'), 'no direct content writes');
    perform phase2a_test.check(not has_table_privilege(role_name, 'public.shopify_product_collections', 'INSERT,UPDATE,DELETE'), 'no direct membership writes');
  end loop;
end;
$$;

insert into auth.users (id) values
  ('91000000-0000-4000-8000-000000000001'), ('91000000-0000-4000-8000-000000000002'),
  ('91000000-0000-4000-8000-000000000003'), ('91000000-0000-4000-8000-000000000004');
insert into public.profiles (id, email, role, display_name, active) values
  ('91000000-0000-4000-8000-000000000001', 'admin@phase2a.test', 'admin', 'Admin', true),
  ('91000000-0000-4000-8000-000000000002', 'user@phase2a.test', 'user', 'User', true),
  ('91000000-0000-4000-8000-000000000003', 'warehouse@phase2a.test', 'warehouse', 'Warehouse', true),
  ('91000000-0000-4000-8000-000000000004', 'inactive@phase2a.test', 'user', 'Inactive', false);
do $$
declare
  profile record;
  visible_content integer;
  visible_collections integer;
begin
  for profile in select id, role, active from public.profiles where email like '%@phase2a.test' loop
    perform set_config('request.jwt.claim.sub', profile.id::text, true);
    set local role authenticated;
    select count(*) into visible_content from public.shopify_product_content;
    select count(*) into visible_collections from public.shopify_product_collections;
    reset role;
    perform phase2a_test.check((visible_content > 0) = (profile.active and profile.role in ('admin', 'user')), 'content RLS');
    perform phase2a_test.check((visible_collections > 0) = (profile.active and profile.role in ('admin', 'user')), 'membership RLS');
  end loop;
end;
$$;

rollback;
\echo 'Phase 2A transactional assertions passed; all fixture data rolled back.'
