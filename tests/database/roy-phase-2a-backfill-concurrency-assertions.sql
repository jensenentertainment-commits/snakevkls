\set ON_ERROR_STOP on
do $$ begin
 if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$' or current_setting('snake.phase2a_isolated',true) is distinct from 'on' then raise exception 'Isolated database required';end if;
end; $$;
select phase2a_test.check((select count(*)=2 from phase2a_test.backfill_race),'two independent clients completed');
select phase2a_test.check((select count(*)=1 from private.sync_runs),'only one fresh run admitted');
select phase2a_test.check((select count(*)=1 from phase2a_test.backfill_race where outcome in ('admitted','ordinary-acquired')),'one admission winner');
select phase2a_test.check((select count(*)<=1 from private.shopify_backfill_operations),'no second protected operation');
select phase2a_test.check(not exists(select 1 from private.shopify_backfill_operations) or public.claim_shopify_sync_run('manual')->>'acquired'='false','ordinary worker cannot adopt winner');
