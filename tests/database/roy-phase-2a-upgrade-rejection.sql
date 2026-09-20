\ir roy-phase-2a-acceptance.guard.sql
-- Called only after the real Commit 8 migration failed with 23514 in one TX.
select phase2a_test.check(phase2a_test.snapshot()=(select snapshot from phase2a_test.upgrade_state),
  'rejected migration preserved historical rows, checkpoint and all writer state');
select phase2a_test.check(to_regclass('private.shopify_backfill_operations') is null,
  'failed migration did not partially install controls');
select phase2a_test.check(exists(select 1 from pg_constraint where conrelid='public.shopify_product_content'::regclass
  and conname='shopify_product_content_category_valid'), 'historical constraint restored');
-- Explicit repair of this synthetic fixture only, never a production repair rule.
update public.shopify_product_content set shopify_category_id='gid://shopify/TaxonomyCategory/aa-1'
where shopify_product_id='gid://shopify/Product/99102';
update phase2a_test.upgrade_state set snapshot=phase2a_test.snapshot();
