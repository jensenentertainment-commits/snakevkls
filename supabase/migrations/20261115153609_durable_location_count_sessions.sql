-- Package B: counts document observations; no quantity/location changes.
-- UUID revisions detect ABA changes without a shared sequence or location write lock.
alter table public.inventory add column count_revision uuid not null default gen_random_uuid();
create function public.inventory_count_revision_v1() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    new.count_revision := gen_random_uuid();
  elsif row(new.id,new.product_id,new.location_id,new.zone_id,new.quantity)
    is distinct from row(old.id,old.product_id,old.location_id,old.zone_id,old.quantity) then
    new.count_revision := gen_random_uuid();
  else
    new.count_revision := old.count_revision;
  end if;
  return new;
end; $$;
create trigger inventory_count_revision_v1 before insert or update on public.inventory
for each row execute function public.inventory_count_revision_v1();
revoke all on function public.inventory_count_revision_v1() from public, anon, authenticated;

create table public.location_count_sessions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  location_code text not null,
  status text not null default 'active' check(status in ('active','completed','abandoned')),
  version integer not null default 1 check(version > 0),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  completed_by uuid,
  result jsonb,
  check ((status = 'completed') = (completed_at is not null and result is not null))
);
create unique index location_count_one_active on public.location_count_sessions(location_id) where status='active';
create index location_count_latest on public.location_count_sessions(location_id,created_at desc);
create table public.location_count_session_lines (
  session_id uuid not null references public.location_count_sessions(id),
  -- Snapshots deliberately have no inventory/product FK: deletion must not erase history.
  inventory_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  variant_name text,
  sku text,
  source_revision uuid not null,
  expected_quantity integer not null check(expected_quantity >= 0),
  counted_quantity integer check(counted_quantity >= 0),
  note text,
  saved_at timestamptz,
  saved_by uuid,
  count_id uuid references public.location_counts(id),
  primary key(session_id,inventory_id),
  check ((counted_quantity is null and saved_at is null and count_id is null)
    or (counted_quantity is not null and saved_at is not null and count_id is not null))
);
alter table public.location_counts add column session_id uuid references public.location_count_sessions(id);
create index location_counts_session on public.location_counts(session_id) where session_id is not null;
alter table public.location_count_sessions enable row level security;
alter table public.location_count_session_lines enable row level security;
revoke all on public.location_count_sessions, public.location_count_session_lines from public, anon, authenticated;
grant select,insert,update on public.location_count_sessions, public.location_count_session_lines to service_role;

create function public.get_location_count_session_v1(requested_location_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select to_jsonb(s) || jsonb_build_object('lines',coalesce((
    select jsonb_agg(to_jsonb(l) order by l.product_name,l.inventory_id)
    from public.location_count_session_lines l where l.session_id=s.id
  ),'[]'::jsonb)) from public.location_count_sessions s
  where s.location_id=requested_location_id
  order by (s.status='active') desc,s.created_at desc,s.id desc limit 1;
$$;

create function public.manage_location_count_v1(
  requested_action text, requested_location_id uuid, requested_session_id uuid,
  expected_version integer, requested_inventory_id uuid, requested_counted_quantity integer,
  requested_note text, requested_actor_id uuid, requested_actor_email text, requested_actor_name text
) returns jsonb language plpgsql volatile security invoker set search_path = ''
set lock_timeout = '2s' set statement_timeout = '15s' as $$
declare
  s public.location_count_sessions%rowtype;
  loc public.locations%rowtype;
  line public.location_count_session_lines%rowtype;
  inv public.inventory%rowtype;
  saved_count_id uuid;
  summary jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Counting requires READ COMMITTED' using errcode='22023';
  end if;
  if requested_action is null or requested_action not in ('start','save','complete','restart')
     or requested_location_id is null or requested_actor_id is null then
    raise exception 'Invalid count command' using errcode='22023';
  end if;
  if requested_action='start' then
    if requested_session_id is not null or expected_version is not null then
      raise exception 'Invalid start command' using errcode='22023';
    end if;
    select * into s from public.location_count_sessions
      where location_id=requested_location_id and status='active' for update nowait;
    if found then return public.get_location_count_session_v1(requested_location_id); end if;
  else
    select * into s from public.location_count_sessions where id=requested_session_id for update nowait;
    if not found or s.location_id is distinct from requested_location_id then
      raise exception 'Unknown count session' using errcode='22023';
    end if;
    -- Retrying the same completion returns the persisted result, with no new event.
    if requested_action='complete' and s.status='completed' and expected_version=s.version-1 then
      return to_jsonb(s) || jsonb_build_object('lines',(
        select coalesce(jsonb_agg(to_jsonb(l) order by l.product_name,l.inventory_id),'[]'::jsonb)
        from public.location_count_session_lines l where l.session_id=s.id));
    end if;
    if s.status <> 'active' or s.version is distinct from expected_version then
      raise exception 'Count session changed; reload' using errcode='40001';
    end if;
  end if;

  -- Short per-location barrier. Existing FK KEY SHARE conflicts with this lock.
  select * into loc from public.locations where id=requested_location_id for update nowait;
  if not found or loc.active is not true then
    raise exception 'Location is not active' using errcode='22023';
  end if;
  perform id from public.inventory where location_id=loc.id order by id for update nowait;
  -- All subsequent reads are separate statements with a fresh READ COMMITTED snapshot.
  if requested_action='start' then
    select * into s from public.location_count_sessions
      where location_id=loc.id and status='active' for update nowait;
    if found then return public.get_location_count_session_v1(loc.id); end if;
  end if;
  if requested_action in ('start','restart') then
    if requested_action='restart' then
      update public.location_count_sessions set status='abandoned',version=version+1,updated_at=clock_timestamp() where id=s.id;
    end if;
    insert into public.location_count_sessions(location_id,location_code,created_by)
      values(loc.id,loc.code,requested_actor_id) returning * into s;
    insert into public.location_count_session_lines(session_id,inventory_id,product_id,product_name,variant_name,sku,source_revision,expected_quantity)
      select s.id,i.id,i.product_id,p.product_name,p.variant_name,p.sku,i.count_revision,i.quantity
      from public.inventory i join public.products p on p.id=i.product_id where i.location_id=loc.id;
    return public.get_location_count_session_v1(loc.id);
  end if;

  -- Compare the entire set, not just totals: includes zero rows and UUID revisions (ABA).
  if exists (
    select 1 from (select * from public.inventory where location_id=loc.id) i
    full join (select * from public.location_count_session_lines where session_id=s.id) l on l.inventory_id=i.id
    where i.id is null or l.inventory_id is null or i.product_id is distinct from l.product_id
      or i.quantity is distinct from l.expected_quantity or i.count_revision is distinct from l.source_revision
  ) then
    raise exception 'Count basis changed; start a new count explicitly' using errcode='40001';
  end if;

  if requested_action='save' then
    if requested_counted_quantity is null or requested_counted_quantity < 0 then
      raise exception 'Invalid counted quantity' using errcode='22023';
    end if;
    select * into line from public.location_count_session_lines where session_id=s.id and inventory_id=requested_inventory_id;
    if not found then raise exception 'Unknown count line' using errcode='22023'; end if;
    select * into inv from public.inventory where id=line.inventory_id;
    insert into public.location_counts(location_id,inventory_id,expected_quantity,counted_quantity,note,counted_by,counted_by_name,session_id)
      values(loc.id,inv.id,line.expected_quantity,requested_counted_quantity,nullif(btrim(requested_note),''),requested_actor_id,requested_actor_name,s.id)
      returning id into saved_count_id;
    update public.location_count_session_lines set counted_quantity=requested_counted_quantity,
      note=nullif(btrim(requested_note),''),saved_at=clock_timestamp(),saved_by=requested_actor_id,count_id=saved_count_id
      where session_id=s.id and inventory_id=line.inventory_id;
    insert into public.activity_log(entity_type,entity_id,action,title,description,metadata,actor_id,actor_email,actor_name)
      values('location',loc.id,'location_count','Lokasjon telt','Tellelinje lagret. Beholdningen er ikke endret.',
        jsonb_build_object('sessionId',s.id,'countId',saved_count_id,'locationId',loc.id,'inventoryId',line.inventory_id,
          'expectedQuantity',line.expected_quantity,'countedQuantity',requested_counted_quantity,'difference',requested_counted_quantity-line.expected_quantity),
        requested_actor_id,requested_actor_email,requested_actor_name);
    update public.location_count_sessions set version=version+1,updated_at=clock_timestamp() where id=s.id;
  else
    if exists(select 1 from public.location_count_session_lines where session_id=s.id and (saved_at is null or counted_quantity is null or count_id is null)) then
      raise exception 'All count lines must be saved' using errcode='22023';
    end if;
    select jsonb_build_object('totalLines',count(*),'matchedLines',count(*) filter(where counted_quantity=expected_quantity),
      'diffLines',count(*) filter(where counted_quantity<>expected_quantity)) into summary
      from public.location_count_session_lines where session_id=s.id;
    update public.location_count_sessions set status='completed',version=version+1,updated_at=clock_timestamp(),
      completed_at=clock_timestamp(),completed_by=requested_actor_id,result=summary where id=s.id;
    insert into public.activity_log(entity_type,entity_id,action,title,description,metadata,actor_id,actor_email,actor_name)
      values('location',loc.id,'location_count_completed','Lokasjonstelling fullført',
        'Telling dokumentert. Beholdningen er ikke endret.',summary || jsonb_build_object('sessionId',s.id,'locationId',loc.id,'locationCode',loc.code,
          'status',case when (summary->>'diffLines')::integer>0 then 'diff' else 'clean' end),requested_actor_id,requested_actor_email,requested_actor_name);
  end if;
  return public.get_location_count_session_v1(loc.id);
end; $$;

-- Old deployments must not be able to log a fabricated completed count.
create function public.guard_location_count_completion_v1() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.location_count_sessions s where s.id::text=new.metadata->>'sessionId'
    and s.location_id::text=new.entity_id::text and s.status='completed'
    and new.metadata @> s.result) then
    raise exception 'A validated count session is required' using errcode='22023';
  end if;
  return new;
end; $$;
create trigger guard_location_count_completion_v1 before insert or update on public.activity_log
for each row when (new.action='location_count_completed') execute function public.guard_location_count_completion_v1();
create unique index location_count_completion_once on public.activity_log((metadata->>'sessionId'))
  where action='location_count_completed' and metadata->>'sessionId' is not null;
revoke all on function public.guard_location_count_completion_v1() from public, anon, authenticated;
revoke all on function public.get_location_count_session_v1(uuid) from public, anon, authenticated;
revoke all on function public.manage_location_count_v1(text,uuid,uuid,integer,uuid,integer,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.get_location_count_session_v1(uuid) to service_role;
grant execute on function public.manage_location_count_v1(text,uuid,uuid,integer,uuid,integer,text,uuid,text,text) to service_role;
