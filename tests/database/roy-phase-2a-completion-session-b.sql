\ir roy-phase-2a-acceptance.guard.sql
-- Read the committed preview, then overlap the actual completion RPC. Do not
-- update recovery_state before calling: that would test a fixture-table lock.
do $$ declare s phase2a_test.recovery_state%rowtype; r jsonb; begin
  select * into s from phase2a_test.recovery_state;
  r:=public.complete_shopify_backfill_v1(s.op,s.rid,s.preview,'COMPLETE '||s.op||' '||s.rid||' '||(s.preview->>'affectedDigest'));
  perform phase2a_test.check(r->>'status'='completed','concurrent retry returns completed state');
end; $$;
