\set ON_ERROR_STOP on
begin;
\ir roy-phase-2a-targeted.helpers.sql
select phase2a_test.check(not exists (select 1 from private.sync_runs), 'empty disposable sync state required');
select phase2a_test.seed_foundation_product(98001, true, true, 2);
-- Reuse the real Commit 5 page writer from the foundation concurrency fixture.
create table phase2a_test.foundation_claim as
select public.claim_shopify_sync_run('manual', 'targeted-concurrency@example.test', 300) as value;
create table phase2a_test.targeted_reads (sequence integer primary key, observed_state text not null);
commit;
