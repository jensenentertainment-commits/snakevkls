\ir roy-phase-2a-acceptance.guard.sql
-- Shared by the interrupted-before-commit and committed-with-discarded-response
-- sessions. No fake persistence/response objects are used.
do $$ declare s phase2a_test.recovery_state%rowtype; p jsonb; begin
  select * into s from phase2a_test.recovery_state;
  p:=jsonb_build_array(phase2a_test.backfill_product(99001,'[]'));
  perform public.apply_shopify_backfill_page_v1(s.op,s.rid,(s.claim->>'leaseToken')::uuid,null,0,'final',false,
    jsonb_build_array(phase2a_test.variant(99001,99001,'ACCEPTANCE','[]')),p,phase2a_test.traversal(p));
end; $$;
