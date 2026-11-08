\ir roy-phase-2a-acceptance.guard.sql
begin;
\ir roy-phase-2a-sync-persistence.helpers.sql
select phase2a_test.check(not exists(select 1 from public.products) and not exists(select 1 from private.sync_runs),'empty concurrency target');
insert into public.products(id,product_name,shopify_variant_id) values('98800000-0000-4000-8000-000000000001','Concurrency fixture','gid://shopify/ProductVariant/98899');
insert into public.zones(id,code,name,pick_priority) values('98800000-0000-4000-8000-000000000002','CC','Concurrency fixture',213);
insert into public.locations(id,code,zone_id,pick_sequence) values('98800000-0000-4000-8000-000000000003','CC01','98800000-0000-4000-8000-000000000002',1);
insert into public.inventory(id,product_id,zone_id,location_id,quantity) values('98800000-0000-4000-8000-000000000004','98800000-0000-4000-8000-000000000001','98800000-0000-4000-8000-000000000002','98800000-0000-4000-8000-000000000003',0);
insert into public.orders(id,source,external_order_id,order_number,status) values('98800000-0000-4000-8000-000000000005','manual','CC','#CC','picked');
insert into public.order_lines(id,order_id,external_line_id,product_id,product_name,requested_quantity) values('98800000-0000-4000-8000-000000000006','98800000-0000-4000-8000-000000000005','CC-L1','98800000-0000-4000-8000-000000000001','Concurrency fixture',1);
insert into public.pick_jobs(id,order_id,status) values('98800000-0000-4000-8000-000000000007','98800000-0000-4000-8000-000000000005','cancelled');
insert into public.pick_lines(pick_job_id,order_line_id,product_id,inventory_id,location_id,expected_quantity,sequence_number) values('98800000-0000-4000-8000-000000000007','98800000-0000-4000-8000-000000000006','98800000-0000-4000-8000-000000000001','98800000-0000-4000-8000-000000000004','98800000-0000-4000-8000-000000000003',1,1);
create table phase2a_test.catalog_run as select public.claim_shopify_sync_run('manual',null,300) as claim;
select public.apply_shopify_sync_page((claim->>'runId')::uuid,(claim->>'leaseToken')::uuid,null,'final',false,'[]',300) from phase2a_test.catalog_run;
create function phase2a_test.wait_catalog_barrier(number integer, present boolean) returns void language plpgsql as $$
declare deadline timestamptz:=clock_timestamp()+interval '15 seconds';
begin
 loop
   -- Each poll must see sessions opened after this transaction first read statistics.
   perform pg_stat_clear_snapshot();
   if exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.datname=current_database() and l.locktype='advisory' and l.classid=992 and l.objid=number and l.objsubid=2 and l.granted)=present then return; end if;
   if clock_timestamp()>deadline then raise exception 'Catalog concurrency barrier timeout'; end if;
   perform pg_sleep(0.025);
 end loop;
end $$;
commit;
