\ir roy-phase-2a-acceptance.guard.sql
begin;
update phase2a_test.recovery_state set result=public.complete_shopify_backfill_v1(op,rid,preview,
  'COMPLETE '||op||' '||rid||' '||(preview->>'affectedDigest'));
select pg_advisory_xact_lock(991,3);
select phase2a_test.wait_for_blocked('phase2a-completion-b');
commit;
