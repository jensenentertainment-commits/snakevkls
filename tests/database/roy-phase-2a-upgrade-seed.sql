\ir roy-phase-2a-acceptance.guard.sql
\ir roy-phase-2a-sync-persistence.helpers.sql
-- Run after Commit 2, BEFORE V2. These are synthetic historical observations.
create table phase2a_test.upgrade_state (claim jsonb, snapshot jsonb);
do $$ declare c jsonb; begin
  c:=public.claim_shopify_sync_run('manual','historical-fixture@example.test',300);
  perform public.apply_shopify_sync_page((c->>'runId')::uuid,(c->>'leaseToken')::uuid,null,'historical-page',true,
    jsonb_build_array(phase2a_test.variant(99101,99101,'HISTORICAL')),300);
  perform public.pause_shopify_sync_run((c->>'runId')::uuid,(c->>'leaseToken')::uuid,'upgrade fixture');
  insert into public.shopify_product_content(shopify_product_id,product_name,description,product_handle,shopify_status,
    shopify_updated_at,content_observed_at,synced_at,shopify_category_id,shopify_category_full_name)
  values('gid://shopify/Product/99102','Historical canonical','Old content','reassigned-handle','ACTIVE',
    '2026-09-01T00:00:00Z','2026-09-02T00:00:00Z','2026-09-03T00:00:00Z',null,'Malformed historical category');
  -- The historical CHECK admits SQL UNKNOWN; the upgrade must reject this row.
  insert into phase2a_test.upgrade_state values(c,phase2a_test.snapshot());
end; $$;
