\ir roy-phase-2a-acceptance.guard.sql
begin;
select 1 from private.shopify_backfill_operations where operation_id=(select op from phase2a_test.recovery_state) for update;
-- Runner starts reclaim only after this barrier is visible in pg_locks.
select pg_advisory_xact_lock(991,1);
select phase2a_test.wait_for_blocked('phase2a-reclaim');
-- Deterministic regression: old claim holds this run while waiting for our op,
-- so NOWAIT fails with 55P03. Correct claim waits for the operation FIRST.
select 1 from private.sync_runs where id=(select rid from phase2a_test.recovery_state) for update nowait;
do $$ declare s phase2a_test.recovery_state%rowtype; begin
  select * into s from phase2a_test.recovery_state;
  perform phase2a_test.reject_command(format('select public.apply_shopify_backfill_page_v1(%L,%L,%L,null,0,null,false,%L,%L,%L)',
    s.op,s.rid,s.stale_token,'[]','[]','[]'),'lease is not valid');
end; $$;
commit;
