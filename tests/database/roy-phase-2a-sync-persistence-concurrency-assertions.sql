\set ON_ERROR_STOP on
do $$
begin
  if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$'
    or current_setting('snake.phase2a_isolated', true) is distinct from 'on'
  then raise exception 'Isolated database opt-in required'; end if;
end;
$$;
select phase2a_test.check((select count(*) = 2 from phase2a_test.results), 'both processes completed');
select phase2a_test.check((select count(*) = 1 from phase2a_test.results where outcome = 'committed'), 'one page commits');
select phase2a_test.check((select count(*) = 1 from phase2a_test.results where outcome = 'checkpoint-conflict'), 'duplicate is fenced');
select phase2a_test.check((select pages_processed = 1 and processed_count = 1 and collections_linked = 1
  from private.sync_runs), 'no doubled counters');
select phase2a_test.check((select count(*) = 1 from public.products), 'one variant');
select phase2a_test.check((select count(*) = 1 from public.product_collections), 'one legacy relation');
select phase2a_test.check((select count(*) = 1 from private.sync_run_variants), 'one seen variant');
select phase2a_test.check((select count(*) = 1 and bool_and(collections_complete) from public.shopify_product_content), 'one complete canonical product');
select phase2a_test.check((select count(*) = 1 from public.shopify_product_collections), 'one canonical relation');
\echo 'Phase 2A concurrent page fencing assertions passed. Discard this disposable database.'
