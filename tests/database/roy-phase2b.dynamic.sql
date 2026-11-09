\set ON_ERROR_STOP on
begin;
set local snake.phase2a_isolated='on';
\ir roy-phase-2a-acceptance.guard.sql
\ir ../../supabase/migrations/20261109191325_roy_catalog_review.sql
create function pg_temp.check_it(ok boolean,label text) returns void language plpgsql as $$ begin
  if ok is not true then raise exception 'FAILED: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
select pg_temp.check_it(not exists(select 1 from public.shopify_connections where shop<>'fixture.myshopify.com'),'only established synthetic connection');
create temporary table preserved as select
  (select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'')) from public.products p) products,
  (select md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text,'')) from public.inventory i) inventory;
insert into public.shopify_connections(shop,access_token)
select 'fixture.myshopify.com','synthetic-not-a-token' where not exists(select 1 from public.shopify_connections);
insert into auth.users(id) values('97000000-0000-4000-8000-000000000092');
insert into public.profiles(id,email,role,display_name,active) values('97000000-0000-4000-8000-000000000092','review@example.test','admin','Synthetic review',true);
insert into public.products(shopify_product_id,shopify_variant_id,product_name,sku,active) values
('gid://shopify/Product/9792001','gid://shopify/ProductVariant/9792001','Synthetic review',null,true),
('gid://shopify/Product/9792001','gid://shopify/ProductVariant/9792002','Synthetic review','DUP',true),
('gid://shopify/Product/9792001','gid://shopify/ProductVariant/9792003','Synthetic review','DUP',true);
insert into public.shopify_product_content(shopify_product_id,product_name,description,product_handle,shopify_status,shopify_updated_at,content_observed_at,synced_at,collections_complete,collections_observed_at)
values('gid://shopify/Product/9792001','Synthetic review','','roy-review-fixture','ACTIVE',now(),now(),now(),true,now());
select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000092',true);
set local role authenticated;
select public.run_roy_review_v1('97000000-0000-4000-8000-000000000101');
select pg_temp.check_it((select count(*)=1 from public.roy_review_findings where entity_id='gid://shopify/Product/9792001' and rule='description_empty'),'one product finding across variants');
select pg_temp.check_it((select count(*)=1 from public.roy_review_findings where entity_id='gid://shopify/ProductVariant/9792001' and rule='sku_missing' and priority=3),'optional SKU information only');
select pg_temp.check_it((select count(*)=2 from public.roy_review_findings where rule='sku_shared' and priority=3),'shared SKU informational, no merge');
select public.run_roy_review_v1('97000000-0000-4000-8000-000000000101');
select pg_temp.check_it((select count(*)=1 from public.roy_review_runs),'idempotent request');
select public.run_roy_review_v1('97000000-0000-4000-8000-000000000102');
select pg_temp.check_it((select count(*)=0 from public.roy_review_events where run_id='97000000-0000-4000-8000-000000000102'),'repeat has no new events');
reset role;
create temporary table stable_finding as select id from public.roy_review_findings where entity_id='gid://shopify/Product/9792001' and rule='description_empty';
update public.shopify_product_content set description='Now described',image_url='https://example.test/image.png' where shopify_product_id='gid://shopify/Product/9792001';
set local role authenticated;
select public.run_roy_review_v1('97000000-0000-4000-8000-000000000103');
select pg_temp.check_it((select state='resolved' from public.roy_review_findings where entity_id='gid://shopify/Product/9792001' and rule='description_empty'),'known correction resolves');
reset role;
update public.shopify_product_content set description='' where shopify_product_id='gid://shopify/Product/9792001';
set local role authenticated;
select public.run_roy_review_v1('97000000-0000-4000-8000-000000000104');
select pg_temp.check_it((select count(*)=1 from public.roy_review_events e join public.roy_review_findings f on f.id=e.finding_id where e.run_id='97000000-0000-4000-8000-000000000104' and e.event='reopened' and f.rule='description_empty'),'reopens existing identity');
reset role;
select pg_temp.check_it((select f.id=s.id from public.roy_review_findings f cross join stable_finding s where f.rule='description_empty' and f.entity_id='gid://shopify/Product/9792001'),'stable finding UUID');
delete from public.shopify_product_content where shopify_product_id='gid://shopify/Product/9792001';
set local role authenticated;
select public.run_roy_review_v1('97000000-0000-4000-8000-000000000105');
select pg_temp.check_it((select state='open' and assessment='unknown' from public.roy_review_findings where rule='description_empty' and entity_id='gid://shopify/Product/9792001'),'unknown never resolves open finding');
reset role;
update public.products set active=false where shopify_product_id='gid://shopify/Product/9792001';
set local role authenticated;
select public.run_roy_review_v1('97000000-0000-4000-8000-000000000106');
select pg_temp.check_it((select state='out_of_scope' from public.roy_review_findings where rule='description_empty' and entity_id='gid://shopify/Product/9792001'),'inactive is not fixed');
do $$ begin
  begin insert into public.roy_review_runs values(gen_random_uuid(),'forged',auth.uid(),1,now(),'{}'); raise exception 'DML allowed'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.check_it(not has_function_privilege('anon','public.run_roy_review_v1(uuid)','execute') and not has_function_privilege('service_role','public.run_roy_review_v1(uuid)','execute'),'anonymous and service execution denied');
select pg_temp.check_it(public.get_roy_review_v1()->'run'->>'id'='97000000-0000-4000-8000-000000000106','latest completed report');
reset role;
insert into private.sync_runs(id,status,source) values('97000000-0000-4000-8000-000000000199','failed','manual');
set local role authenticated;
do $$ begin
  begin perform public.run_roy_review_v1('97000000-0000-4000-8000-000000000107'); raise exception 'unfinished sync accepted'; exception when object_not_in_prerequisite_state then null; end;
end $$;
select pg_temp.check_it((select count(*)=6 from public.roy_review_runs),'blocked review leaves previous report');
reset role;
update public.profiles set role='user' where id='97000000-0000-4000-8000-000000000092';
set local role authenticated;
select pg_temp.check_it(public.get_roy_review_v1()->'run' is not null,'user reads report');
do $$ begin
  begin perform public.run_roy_review_v1(gen_random_uuid()); raise exception 'user may run'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set role='warehouse' where id='97000000-0000-4000-8000-000000000092';
set local role authenticated;
do $$ begin
  begin perform public.get_roy_review_v1(); raise exception 'warehouse may read'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.check_it((select count(*)=0 from public.roy_review_findings),'RLS hides report from warehouse');
reset role;
delete from private.sync_runs where id='97000000-0000-4000-8000-000000000199';
update public.profiles set role='admin',active=false where id='97000000-0000-4000-8000-000000000092';
set local role authenticated;
do $$ begin
  begin perform public.run_roy_review_v1(gen_random_uuid()); raise exception 'inactive may run'; exception when insufficient_privilege then null; end;
  begin perform public.get_roy_review_v1(); raise exception 'inactive may read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set active=true where id='97000000-0000-4000-8000-000000000092';
create function pg_temp.fail_review_event() returns trigger language plpgsql as $$ begin raise exception 'Synthetic rollback fault'; end $$;
create trigger synthetic_review_fault before insert on public.roy_review_events for each row execute function pg_temp.fail_review_event();
update public.products set active=true where shopify_product_id='gid://shopify/Product/9792001';
set local role authenticated;
do $$ begin
  begin perform public.run_roy_review_v1('97000000-0000-4000-8000-000000000108'); raise exception 'Fault not triggered';
  exception when raise_exception then if sqlerrm<>'Synthetic rollback fault' then raise; end if; end;
end $$;
select pg_temp.check_it((select count(*)=6 from public.roy_review_runs),'failure rolls back run insertion');
select pg_temp.check_it((select state='out_of_scope' from public.roy_review_findings where entity_id='gid://shopify/Product/9792001' and rule='content_unknown'),'failure rolls back finding transitions');
reset role;
drop trigger synthetic_review_fault on public.roy_review_events;
insert into public.products(shopify_product_id,shopify_variant_id,product_name,sku,active)
select 'gid://shopify/Product/'||(979200000+n),'gid://shopify/ProductVariant/'||(979200000+n),'Synthetic page '||n,null,true from generate_series(1,1000) n;
set local role authenticated;
\timing on
select public.run_roy_review_v1('97000000-0000-4000-8000-000000000109');
\timing off
select pg_temp.check_it((select (summary->>'products')::int>=1000 from public.roy_review_runs where id='97000000-0000-4000-8000-000000000109'),'report covers 1000 synthetic products');
select pg_temp.check_it(jsonb_array_length(public.get_roy_review_v1()->'findings')=50,'report page bounded to 50');
select pg_temp.check_it(jsonb_array_length(public.get_roy_review_v1(50,'97000000-0000-4000-8000-000000000109')->'findings')>0,'detail pagination available');
do $$ begin
  begin perform public.get_roy_review_v1(0,'97000000-0000-4000-8000-000000000106'); raise exception 'stale page accepted'; exception when serialization_failure then null; end;
end $$;
reset role;
select pg_temp.check_it((select inventory=(select md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text,'')) from public.inventory i) from preserved),'inventory unchanged');
select pg_temp.check_it((select products=(select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'')) from public.products p where shopify_product_id not like 'gid://shopify/Product/9792%' or shopify_product_id is null) from preserved),'existing products unchanged');
rollback;
select 'PASS: migration and synthetic review data rolled back' as result;
