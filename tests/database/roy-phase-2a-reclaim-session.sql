\ir roy-phase-2a-acceptance.guard.sql
update phase2a_test.recovery_state set claim=public.claim_shopify_backfill_v1(op,rid,'RESUME '||op||' '||rid);
select phase2a_test.check((select claim->>'acquired'='true' and claim->>'leaseToken'<>stale_token::text
  from phase2a_test.recovery_state),'reclaim issued a new fenced token');
select phase2a_test.check((select count(*)=0 from private.shopify_backfill_pages),'expired page did not commit');
