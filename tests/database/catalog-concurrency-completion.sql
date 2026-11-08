\ir roy-phase-2a-acceptance.guard.sql
begin;
select phase2a_test.wait_catalog_barrier(1,true);
do $$ declare c jsonb; before_state jsonb:=phase2a_test.snapshot(); begin
 select claim into strict c from phase2a_test.catalog_run;
 begin
   perform public.complete_shopify_sync_run((c->>'runId')::uuid,(c->>'leaseToken')::uuid);
   raise exception 'TEST expected nonblocking lock conflict';
 exception when lock_not_available then null; end;
 assert phase2a_test.snapshot()=before_state,'Lock conflict must roll back all completion effects';
 perform pg_advisory_xact_lock(992,2);
 perform phase2a_test.wait_catalog_barrier(1,false);
 -- Same persisted terminal checkpoint can now complete; rollback test result.
 perform public.complete_shopify_sync_run((c->>'runId')::uuid,(c->>'leaseToken')::uuid);
 assert not (select active from public.products where id='98800000-0000-4000-8000-000000000001');
 assert (select quantity=0 from public.inventory where id='98800000-0000-4000-8000-000000000004');
end $$;
rollback;
