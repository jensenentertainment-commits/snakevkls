\ir roy-phase-2a-acceptance.guard.sql
do $$ declare c jsonb; old_id uuid; begin
  perform phase2a_test.check(phase2a_test.snapshot()=(select snapshot from phase2a_test.upgrade_state),
    'forward migrations do not rewrite historical data/checkpoints');
  select id into old_id from public.products where sku='HISTORICAL';
  c:=public.claim_shopify_sync_run('manual','upgraded-fixture@example.test',300);
  perform phase2a_test.check(c->>'runId'=(select claim->>'runId' from phase2a_test.upgrade_state)
    and c->>'cursor'='historical-page' and c->>'pagesProcessed'='1' and c->>'hasNextPage'='true', 'resume exact old checkpoint');
  perform public.apply_shopify_sync_page_v2((c->>'runId')::uuid,(c->>'leaseToken')::uuid,'historical-page',1,'new-final',false,
    jsonb_build_array(phase2a_test.variant(99103,99103,'UPGRADED')),jsonb_build_array(phase2a_test.product(99103)),300);
  perform phase2a_test.check(not exists(select 1 from public.shopify_product_content where shopify_product_id='gid://shopify/Product/99101'),
    'old checkpointed page remains UNKNOWN, never fabricated');
  perform phase2a_test.check((select count(*)=2 from public.shopify_product_content where product_handle='reassigned-handle'),
    'handle reassignment succeeds through V2 after forward nonunique index');
  perform phase2a_test.check((select id=old_id and active from public.products where sku='HISTORICAL'), 'old variant identity survives upgrade');
  perform public.complete_shopify_sync_run((c->>'runId')::uuid,(c->>'leaseToken')::uuid);
  perform phase2a_test.check((select active from public.products where id=old_id), 'historical seen IDs survive resumed completion');
end; $$;
-- Remove only this matrix's synthetic fixtures so the existing empty-catalog
-- suites can run on the UPGRADED schema. No production checkpoint reset tool.
delete from public.product_collections where product_id in (select id from public.products where sku in ('HISTORICAL','UPGRADED'));
delete from public.products where sku in ('HISTORICAL','UPGRADED');
delete from public.shopify_product_content where shopify_product_id in ('gid://shopify/Product/99102','gid://shopify/Product/99103');
delete from private.sync_run_variants where run_id=(select (claim->>'runId')::uuid from phase2a_test.upgrade_state);
delete from private.sync_runs where id=(select (claim->>'runId')::uuid from phase2a_test.upgrade_state);
drop schema phase2a_test cascade;
