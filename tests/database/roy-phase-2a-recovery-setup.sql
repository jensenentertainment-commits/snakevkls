\ir roy-phase-2a-acceptance.guard.sql
\ir roy-phase-2a-backfill.helpers.sql
create table phase2a_test.recovery_state(op uuid, rid uuid, stale_token uuid, claim jsonb, preview jsonb, result jsonb, before_state jsonb);
create function phase2a_test.control_snapshot() returns jsonb language sql as $$
  select jsonb_build_object('page',phase2a_test.snapshot(),
    'operations',(select jsonb_agg(to_jsonb(o) order by operation_id) from private.shopify_backfill_operations o),
    'receipts',(select jsonb_agg(to_jsonb(p) order by operation_id,page_number) from private.shopify_backfill_pages p));
$$;
create function phase2a_test.wait_for_blocked(worker text) returns void language plpgsql as $$
declare deadline timestamptz:=clock_timestamp()+interval '12 seconds';
begin
  loop
    perform pg_stat_clear_snapshot();
    exit when exists(select 1 from pg_stat_activity where application_name=worker
      and pg_backend_pid()=any(pg_blocking_pids(pid)));
    if clock_timestamp()>deadline then raise exception 'Barrier timeout: % did not block on this session',worker;end if;
    perform pg_sleep(0.02);
  end loop;
end; $$;
do $$ declare op uuid:='99000000-0000-4000-8000-000000000001'; c jsonb; rid uuid; token uuid; before_state jsonb; command text; begin
  c:=public.start_shopify_backfill_v1(op,phase2a_test.backfill_identity(),'START '||op||' abcdefghijklmnopqrst fixture.myshopify.com');
  rid:=(c->>'runId')::uuid;
  c:=public.claim_shopify_backfill_v1(op,rid,'RESUME '||op||' '||rid);token:=(c->>'leaseToken')::uuid;
  -- Expiration must NEVER allow an ordinary worker to adopt/mutate this run.
  update private.sync_runs set lease_expires_at=clock_timestamp()-interval '1 second' where id=rid;
  before_state:=phase2a_test.control_snapshot();
  perform phase2a_test.check(public.claim_shopify_sync_run('cron')->>'acquired'='false','expired protected claim excluded');
  foreach command in array array[
    format('select public.apply_shopify_sync_page(%L,%L,null,null,false,%L)',rid,token,'[]'),
    format('select public.apply_shopify_sync_page_v2(%L,%L,null,0,null,false,%L,%L)',rid,token,'[]','[]'),
    format('select public.pause_shopify_sync_run(%L,%L,%L)',rid,token,'ordinary'),
    format('select public.fail_shopify_sync_run(%L,%L,%L)',rid,token,'ordinary'),
    format('select public.complete_shopify_sync_run(%L,%L)',rid,token)
  ] loop
    perform phase2a_test.reject_command(command,'Protected operation');
    perform phase2a_test.check(phase2a_test.control_snapshot()=before_state,'ordinary entry point cannot mutate expired protected state');
  end loop;
  perform phase2a_test.reject_command(format('select public.claim_shopify_backfill_v1(%L,%L,%L)',op,gen_random_uuid(),'RESUME '||op||' '||rid),'approval mismatch');
  perform phase2a_test.check(phase2a_test.control_snapshot()=before_state,'identity rejection preserves state');
  insert into phase2a_test.recovery_state(op,rid,stale_token,before_state) values(op,rid,token,before_state);
end; $$;
