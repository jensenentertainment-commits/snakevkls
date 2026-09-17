\set ON_ERROR_STOP on
do $$
begin
  if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$'
    or current_setting('snake.phase2a_isolated', true) is distinct from 'on'
  then raise exception 'Isolated database opt-in required'; end if;
end;
$$;
set statement_timeout = '15s';
begin;
select public.apply_shopify_sync_page_v2(
  (c.value ->> 'runId')::uuid, (c.value ->> 'leaseToken')::uuid, null, 0, 'foundation-final', false,
  jsonb_build_array(phase2a_test.variant(98001, 98001, 'CF-98001', '[]')),
  jsonb_build_array(jsonb_set(phase2a_test.product(98001, '[]'), '{productContent,description}', '""')), 300
) from phase2a_test.foundation_claim as c;
-- Leave all real page writes uncommitted while the other connection reads.
select pg_sleep(2);
commit;
