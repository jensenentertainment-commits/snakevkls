\set ON_ERROR_STOP on
do $$
begin
  if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$'
    or current_setting('snake.phase2a_isolated', true) is distinct from 'on'
  then raise exception 'Isolated database opt-in required'; end if;
end;
$$;
select phase2a_test.check((select count(*) = 60 from phase2a_test.foundation_reads), 'all reads completed');
select phase2a_test.check(exists(select 1 from phase2a_test.foundation_reads where observed_state = 'old'), 'reader overlapped before commit');
select phase2a_test.check(exists(select 1 from phase2a_test.foundation_reads where observed_state = 'new'), 'reader overlapped after commit');
select phase2a_test.check((select pages_processed = 1 from private.sync_runs), 'one real Commit 5 page committed');
select phase2a_test.check(not exists(select 1 from public.shopify_product_collections), 'new complete-empty snapshot');
\echo 'Concurrent reader saw only complete old/new page states. Discard the disposable database.'
