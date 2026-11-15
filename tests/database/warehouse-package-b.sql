-- Synthetic only, within the runner's rollback transaction.
create function pg_temp.check_b(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end; $$;
do $$
declare
 z uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); other_l uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); i uuid:=gen_random_uuid(); i2 uuid:=gen_random_uuid();
 actor uuid:=gen_random_uuid(); s jsonb; original jsonb; sid uuid; rev uuid; n bigint; event_n bigint;
begin
 insert into public.zones(id,code,name,pick_priority) values(z,'PKGB-'||z,'Synthetic counting',99997);
 insert into public.locations(id,code,zone_id,active,pick_sequence) values(l,'PKGB-'||l,z,true,1),(other_l,'PKGB-'||other_l,z,true,2);
 insert into public.products(id,product_name,sku) values(p,'Synthetic count without SKU',null),(p2,'Synthetic count zero',null);
 insert into public.inventory(id,product_id,location_id,zone_id,quantity) values(i,p,l,z,10),(i2,p2,l,z,0);
 select count(*) into n from public.stock_movements;
 s:=public.manage_location_count_v1('start',l,null,null,null,null,null,actor,null,'Synthetic'); sid:=(s->>'id')::uuid;
 perform pg_temp.check_b(jsonb_array_length(s->'lines')=2,'start includes zero and SKU-less lines');
 perform pg_temp.check_b(public.manage_location_count_v1('start',l,null,null,null,null,null,actor,null,null)->>'id'=sid::text,'start resumes same active session');
 begin
   perform public.manage_location_count_v1('complete',l,sid,1,null,null,null,actor,null,null);
   raise exception 'accepted unsaved';
 exception when invalid_parameter_value then null; end;
 perform pg_temp.check_b((select status='active' and version=1 from public.location_count_sessions where id=sid),'unsaved completion rejected atomically');
 s:=public.manage_location_count_v1('save',l,sid,1,i,8,'Observed',actor,null,'Synthetic');
 perform pg_temp.check_b(s->>'version'='2' and (select counted_quantity=8 from public.location_count_session_lines where session_id=sid and inventory_id=i),'save persists count and revision');
 perform pg_temp.check_b(public.get_location_count_session_v1(l)=s,'reload returns persisted progress');
 begin
   perform public.manage_location_count_v1('save',l,sid,1,i2,0,null,actor,null,null);
   raise exception 'accepted stale version';
 exception when serialization_failure then null; end;
 perform pg_temp.check_b((select version=2 from public.location_count_sessions where id=sid),'stale session rejected');
 begin
   perform public.manage_location_count_v1('save',other_l,sid,2,i2,0,null,actor,null,null);
   raise exception 'accepted wrong location';
 exception when invalid_parameter_value then null; end;
 perform pg_temp.check_b((select count(*)=1 from public.location_counts where session_id=sid),'wrong location does not add history');
 s:=public.manage_location_count_v1('save',l,sid,2,i2,0,null,actor,null,null);
 s:=public.manage_location_count_v1('complete',l,sid,3,null,null,null,actor,null,null);
 perform pg_temp.check_b(s->>'status'='completed' and s->>'version'='4' and s->'result'='{"totalLines":2,"matchedLines":1,"diffLines":1}'::jsonb,'server computes completion totals');
 original:=s;
 s:=public.manage_location_count_v1('complete',l,sid,3,null,null,null,actor,null,null);
 perform pg_temp.check_b(s=original and (select count(*)=1 from public.activity_log where metadata->>'sessionId'=sid::text and action='location_count_completed'),'completion replay returns identical result with one event');
 begin
   perform public.manage_location_count_v1('save',l,sid,4,i,10,null,actor,null,null);
   raise exception 'accepted completed edit';
 exception when serialization_failure then null; end;
 perform pg_temp.check_b((select count(*)=2 from public.location_counts where session_id=sid),'completed session immutable through RPC');
 perform pg_temp.check_b((select sum(quantity)=10 from public.inventory where location_id=l) and (select count(*)=n from public.stock_movements),'counting never changes stock or movements');
 select count(*) into event_n from public.activity_log;
 begin
   insert into public.activity_log(entity_type,entity_id,action,title,metadata) values('location',l,'location_count_completed','Old client','{"totalLines":99}');
   raise exception 'accepted legacy completion';
 exception when invalid_parameter_value then null; end;
 perform pg_temp.check_b((select count(*)=event_n from public.activity_log),'old completion event blocked');
 s:=public.manage_location_count_v1('start',l,null,null,null,null,null,actor,null,null); sid:=(s->>'id')::uuid;
 select count_revision into rev from public.inventory where id=i;
 update public.inventory set quantity=9 where id=i;
 update public.inventory set quantity=10 where id=i;
 perform pg_temp.check_b((select count_revision<>rev from public.inventory where id=i),'ABA updates change source revision');
 begin
   perform public.manage_location_count_v1('save',l,sid,1,i,10,null,actor,null,null);
   raise exception 'accepted ABA basis';
 exception when serialization_failure then null; end;
 perform pg_temp.check_b((select count(*)=0 from public.location_counts where session_id=sid),'ABA conflict preserves saved state');
 s:=public.manage_location_count_v1('restart',l,sid,1,null,null,null,actor,null,null);
 perform pg_temp.check_b(s->>'id'<>sid::text and (select status='abandoned' from public.location_count_sessions where id=sid),'explicit restart preserves prior session');
 sid:=(s->>'id')::uuid;
 update public.inventory set location_id=other_l where id=i2;
 begin
   perform public.manage_location_count_v1('save',l,sid,1,i,10,null,actor,null,null);
   raise exception 'accepted removed line';
 exception when serialization_failure then null; end;
 perform pg_temp.check_b((select version=1 from public.location_count_sessions where id=sid),'changed row set rejected');
 s:=public.manage_location_count_v1('start',other_l,null,null,null,null,null,actor,null,null);
 perform pg_temp.check_b(jsonb_array_length(s->'lines')=1,'independent location can start');
 begin
   insert into public.location_count_sessions(location_id,location_code,created_by) values(l,'duplicate',actor);
   raise exception 'accepted second active';
 exception when unique_violation then null; end;
 perform pg_temp.check_b((select count(*)=1 from public.location_count_sessions where location_id=l and status='active'),'unique active session enforced by database');
 select count_revision into rev from public.inventory where id=i;
 update public.inventory set count_revision=gen_random_uuid(),updated_at=clock_timestamp() where id=i;
 perform pg_temp.check_b((select count_revision=rev from public.inventory where id=i),'revision cannot be overwritten by unrelated updates');
end; $$;
select pg_temp.check_b(not has_function_privilege('authenticated','public.manage_location_count_v1(text,uuid,uuid,integer,uuid,integer,text,uuid,text,text)','EXECUTE')
 and not has_table_privilege('authenticated','public.location_count_sessions','INSERT')
 and not has_table_privilege('anon','public.location_count_session_lines','SELECT'),'anonymous and browser direct access denied');
select pg_temp.check_b(has_function_privilege('service_role','public.manage_location_count_v1(text,uuid,uuid,integer,uuid,integer,text,uuid,text,text)','EXECUTE')
 and (select relrowsecurity from pg_class where oid='public.location_count_sessions'::regclass)
 and (select relrowsecurity from pg_class where oid='public.location_count_session_lines'::regclass),'service-only RPC with RLS enabled');

-- Exercise actual DB role privileges, not only ACL metadata.
select id as test_location from public.locations where code like 'PKGB-%' order by code limit 1 \gset
set local role service_role;
select pg_temp.check_b(public.get_location_count_session_v1(:'test_location'::uuid) is not null,'service role can read saved session');
reset role;
set local role authenticated;
do $$ begin
  begin
    perform public.get_location_count_session_v1(gen_random_uuid());
    raise exception 'browser RPC access accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.location_count_sessions;
    raise exception 'browser session read accepted';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: actual authenticated role cannot bypass server adapter';
end $$;
reset role;
