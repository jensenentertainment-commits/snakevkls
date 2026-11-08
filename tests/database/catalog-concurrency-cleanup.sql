\ir roy-phase-2a-acceptance.guard.sql
begin;
select phase2a_test.check((select count(*)=1 from public.products) and (select count(*)=1 from private.sync_runs),'only known concurrency fixtures may be cleaned');
delete from public.pick_lines where pick_job_id='98800000-0000-4000-8000-000000000007';
delete from public.pick_jobs where id='98800000-0000-4000-8000-000000000007';
delete from public.order_lines where id='98800000-0000-4000-8000-000000000006';
delete from public.orders where id='98800000-0000-4000-8000-000000000005';
delete from public.inventory where id='98800000-0000-4000-8000-000000000004';
delete from public.locations where id='98800000-0000-4000-8000-000000000003';
delete from public.zones where id='98800000-0000-4000-8000-000000000002';
delete from public.products where id='98800000-0000-4000-8000-000000000001';
delete from private.sync_run_variants where run_id=(select (claim->>'runId')::uuid from phase2a_test.catalog_run);
delete from private.sync_runs where id=(select (claim->>'runId')::uuid from phase2a_test.catalog_run);
drop schema phase2a_test cascade;
commit;
