-- Additive Roy Phase 2B. No catalog, inventory, sync or Shopify mutations.
create table public.roy_review_runs (
  id uuid primary key,
  shop text not null,
  actor_id uuid not null,
  rule_version integer not null default 1 check (rule_version = 1),
  completed_at timestamptz not null default clock_timestamp(),
  summary jsonb not null
);
create table public.roy_review_findings (
  id uuid primary key default gen_random_uuid(),
  shop text not null,
  entity_id text not null,
  rule text not null,
  priority integer not null check (priority between 1 and 3),
  label text not null,
  state text not null check (state in ('open','resolved','out_of_scope')),
  assessment text not null check (assessment in ('known','unknown')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  evaluated_run uuid not null references public.roy_review_runs(id),
  unique(shop,entity_id,rule)
);
create index roy_review_findings_report_idx on public.roy_review_findings(evaluated_run,state,priority,id);
create table public.roy_review_events (
  run_id uuid not null references public.roy_review_runs(id),
  finding_id uuid not null references public.roy_review_findings(id),
  event text not null check (event in ('new','resolved','reopened','out_of_scope')),
  primary key(run_id,finding_id)
);
alter table public.roy_review_runs enable row level security;
alter table public.roy_review_findings enable row level security;
alter table public.roy_review_events enable row level security;
create policy roy_review_runs_read on public.roy_review_runs for select to authenticated
using ((select private.has_role(array['admin','user'])));
create policy roy_review_findings_read on public.roy_review_findings for select to authenticated
using ((select private.has_role(array['admin','user'])));
create policy roy_review_events_read on public.roy_review_events for select to authenticated
using ((select private.has_role(array['admin','user'])));
revoke all on public.roy_review_runs,public.roy_review_findings,public.roy_review_events from public,anon,authenticated,service_role;
grant select on public.roy_review_runs,public.roy_review_findings,public.roy_review_events to authenticated;

-- Definer is confined to private schema: users cannot fabricate findings via DML.
-- Fixed SQL, explicit active-admin authorization, empty search_path, no secrets returned.
create function private.run_roy_review_v1(request_id uuid) returns uuid
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare
  store text; item record; old public.roy_review_findings; finding uuid;
  at_time timestamptz := clock_timestamp(); transition text; totals jsonb;
  trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if auth.uid() is null or private.has_role(array['admin']) is not true then
    raise exception using errcode='42501',message='Roy review requires active admin';
  end if;
  if request_id is null then raise exception using errcode='22023',message='Request ID required'; end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode='22023',message='Roy review requires read committed';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('snake_roy_review',0)) then
    raise exception using errcode='55P03',message='Roy review already running';
  end if;
  if exists(select 1 from public.roy_review_runs where id=request_id and actor_id=auth.uid()) then return request_id; end if;
  if exists(select 1 from public.roy_review_runs where id=request_id) then
    raise exception using errcode='42501',message='Request belongs to another actor';
  end if;
  -- SHARE locks conflict with all source DML, including sync claims and pages.
  -- NOWAIT avoids waiting behind a worker with an inverse row/table lock order.
  -- Following statements obtain fresh READ COMMITTED snapshots after all locks.
  lock table private.sync_runs,public.shopify_connections,public.products,
    public.shopify_product_content,public.shopify_product_collections in share mode nowait;
  if exists(select 1 from private.sync_runs where status <> 'completed') then
    raise exception using errcode='55000',message='Unfinished catalog sync; previous report retained';
  end if;
  if (select count(*) from public.shopify_connections) <> 1 then
    raise exception using errcode='55000',message='Exactly one catalog shop required';
  end if;
  select shop into strict store from public.shopify_connections;
  insert into public.roy_review_runs(id,shop,actor_id,summary) values(request_id,store,auth.uid(),'{}');

  for item in
    with population as (
      select distinct shopify_product_id from public.products where active and shopify_product_id is not null
    )
    select p.shopify_product_id as entity_id, left(coalesce(c.product_name,p.shopify_product_id),240) as label,
      r.rule,r.priority,r.known,r.matches
    from population p left join public.shopify_product_content c on c.shopify_product_id=p.shopify_product_id
    cross join lateral (values
      ('content_unknown',1,true,c.content_observed_at is null),
      ('collections_unknown',1,true,not coalesce(c.collections_complete,false)),
      ('description_empty',2,c.content_observed_at is not null,nullif(btrim(c.description,trim_chars),'') is null),
      ('image_missing',2,c.content_observed_at is not null,nullif(btrim(c.image_url,trim_chars),'') is null),
      ('category_missing',3,c.content_observed_at is not null,c.shopify_category_id is null),
      ('type_missing',3,c.content_observed_at is not null,nullif(btrim(c.product_type,trim_chars),'') is null),
      ('vendor_missing',3,c.content_observed_at is not null,nullif(btrim(c.vendor,trim_chars),'') is null),
      ('seo_title_default',3,c.content_observed_at is not null,nullif(btrim(c.seo_title,trim_chars),'') is null),
      ('seo_description_default',3,c.content_observed_at is not null,nullif(btrim(c.seo_description,trim_chars),'') is null)
    ) r(rule,priority,known,matches)
    union all
    select p.shopify_variant_id,left(p.product_name || coalesce(' – '||p.variant_name,''),240),
      'sku_missing',3,true,nullif(btrim(p.sku,trim_chars),'') is null
    from public.products p where p.active and p.shopify_product_id is not null and p.shopify_variant_id is not null
    union all
    select p.shopify_variant_id,left(p.product_name || coalesce(' – '||p.variant_name,''),240),
      'sku_shared',3,true,nullif(btrim(p.sku,trim_chars),'') is not null
        and exists(select 1 from public.products q where q.active and q.shopify_product_id is not null and q.id<>p.id and q.sku=p.sku)
    from public.products p where p.active and p.shopify_product_id is not null and p.shopify_variant_id is not null
    order by entity_id,rule
  loop
    select * into old from public.roy_review_findings where shop=store and entity_id=item.entity_id and rule=item.rule;
    transition := null;
    if not item.known then
      if old.id is not null then
        update public.roy_review_findings set assessment='unknown',evaluated_run=request_id where id=old.id;
      end if;
      continue;
    end if;
    if item.matches then
      if old.id is null then
        insert into public.roy_review_findings(shop,entity_id,rule,priority,label,state,assessment,first_seen_at,last_seen_at,evaluated_run)
        values(store,item.entity_id,item.rule,item.priority,item.label,'open','known',at_time,at_time,request_id) returning id into finding;
        transition := 'new';
      else
        finding := old.id;
        if old.state <> 'open' then transition := 'reopened'; end if;
        update public.roy_review_findings set state='open',assessment='known',label=item.label,last_seen_at=at_time,evaluated_run=request_id where id=finding;
      end if;
    elsif old.id is not null then
      finding := old.id;
      if old.state <> 'resolved' then transition := 'resolved'; end if;
      update public.roy_review_findings set state='resolved',assessment='known',evaluated_run=request_id where id=finding;
    end if;
    if transition is not null then
      insert into public.roy_review_events values(request_id,finding,transition);
    end if;
  end loop;
  -- Absence from active population means out of scope, never 'fixed'.
  for old in select * from public.roy_review_findings where shop=store and evaluated_run<>request_id order by id loop
    if old.state <> 'out_of_scope' then
      insert into public.roy_review_events values(request_id,old.id,'out_of_scope');
    end if;
    update public.roy_review_findings set state='out_of_scope',evaluated_run=request_id where id=old.id;
  end loop;
  select jsonb_build_object(
    'products',(select count(distinct shopify_product_id) from public.products where active and shopify_product_id is not null),
    'variants',(select count(*) from public.products where active and shopify_product_id is not null),
    'sourceOldest',(select min(c.content_observed_at) from public.shopify_product_content c where exists(select 1 from public.products p where p.active and p.shopify_product_id=c.shopify_product_id)),
    'sourceNewest',(select max(c.content_observed_at) from public.shopify_product_content c where exists(select 1 from public.products p where p.active and p.shopify_product_id=c.shopify_product_id)),
    'dataGaps',count(*) filter(where state='open' and priority=1),
    'recommendations',count(*) filter(where state='open' and priority=2 and assessment='known'),
    'information',count(*) filter(where state='open' and priority=3 and assessment='known'),
    'uncertain',count(*) filter(where state='open' and assessment='unknown'),
    'new',(select count(*) from public.roy_review_events where run_id=request_id and event='new'),
    'resolved',(select count(*) from public.roy_review_events where run_id=request_id and event='resolved'),
    'reopened',(select count(*) from public.roy_review_events where run_id=request_id and event='reopened')
  ) into totals from public.roy_review_findings where evaluated_run=request_id;
  update public.roy_review_runs set summary=totals,completed_at=clock_timestamp() where id=request_id;
  return request_id;
end $$;
revoke all on function private.run_roy_review_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function private.run_roy_review_v1(uuid) to authenticated;
create function public.run_roy_review_v1(request_id uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.run_roy_review_v1(request_id) $$;
revoke all on function public.run_roy_review_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.run_roy_review_v1(uuid) to authenticated;

create function public.get_roy_review_v1(requested_offset integer default 0, requested_run uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare r public.roy_review_runs; result jsonb;
begin
  if private.has_role(array['admin','user']) is not true then raise exception using errcode='42501',message='Roy report requires active business role'; end if;
  if requested_offset is null or requested_offset<0 or requested_offset>100000 then raise exception using errcode='22023',message='Invalid report offset'; end if;
  select * into r from public.roy_review_runs order by completed_at desc,id desc limit 1;
  if r.id is null then return jsonb_build_object('run',null,'findings','[]'::jsonb,'total',0); end if;
  if requested_run is not null and requested_run<>r.id then raise exception using errcode='40001',message='Report changed; reload'; end if;
  select jsonb_build_object('run',to_jsonb(r)-'actor_id','total',
    (select count(*) from public.roy_review_findings where evaluated_run=r.id),
    'findings',coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb)) into result from (
    select f.id,f.entity_id,f.rule,f.priority,f.label,f.state,f.assessment,f.first_seen_at,f.last_seen_at,e.event
    from public.roy_review_findings f left join public.roy_review_events e on e.finding_id=f.id and e.run_id=r.id
    where f.evaluated_run=r.id
    order by (f.state='open') desc,f.priority,f.id limit 50 offset requested_offset
  ) f;
  return result;
end $$;
revoke all on function public.get_roy_review_v1(integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_roy_review_v1(integer,uuid) to authenticated;
