-- Phase 1: centralize active-profile and role authorization in Postgres.
-- The private schema is not exposed through the Supabase Data API.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.active is true
      and profile.role = any (allowed_roles)
      and profile.role = any (array['admin', 'lager']::text[])
  );
$$;

revoke execute on function private.has_role(text[]) from public, anon;
grant execute on function private.has_role(text[]) to authenticated;

alter table public.profiles
  drop constraint if exists profiles_role_valid;

-- Reuse the existing constraint name. NOT VALID keeps historical invalid roles
-- unchanged and inaccessible; it still rejects new invalid role values.
alter table public.profiles
  add constraint profiles_role_valid
  check (role in ('admin', 'lager')) not valid;

-- Today's schema has no invalid roles, so validation succeeds immediately. If
-- a legacy invalid role exists at deploy time, access is denied and cleanup can
-- happen explicitly without silently promoting that user.
do $$
begin
  if not exists (
    select 1
    from public.profiles
    where role not in ('admin', 'lager')
  ) then
    alter table public.profiles validate constraint profiles_role_valid;
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.inventory enable row level security;
alter table public.locations enable row level security;
alter table public.zones enable row level security;
alter table public.stock_movements enable row level security;
alter table public.activity_log enable row level security;

-- Remove the previous authenticated-is-authorized policies.
drop policy if exists "Authenticated read own profile" on public.profiles;

drop policy if exists "Authenticated read inventory" on public.inventory;
drop policy if exists "Authenticated insert inventory" on public.inventory;
drop policy if exists "Authenticated update inventory" on public.inventory;

drop policy if exists "Authenticated read locations" on public.locations;
drop policy if exists "Authenticated insert locations" on public.locations;
drop policy if exists "Authenticated update locations" on public.locations;

drop policy if exists "Authenticated read zones" on public.zones;
drop policy if exists "Authenticated insert zones" on public.zones;
drop policy if exists "Authenticated update zones" on public.zones;

drop policy if exists "Authenticated read stock movements" on public.stock_movements;
drop policy if exists "Authenticated insert stock movements" on public.stock_movements;

drop policy if exists "Authenticated read activity log" on public.activity_log;
drop policy if exists "Authenticated insert activity log" on public.activity_log;

-- Profiles: an inactive or missing profile yields no application access.
create policy "Active users read own profile"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  and active is true
  and role in ('admin', 'lager')
);

-- Inventory, locations and zones: all active roles read; admin/lager operate;
-- destructive operations remain admin-only.
create policy "Active users read inventory"
on public.inventory for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Warehouse roles insert inventory"
on public.inventory for insert to authenticated
with check ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Warehouse roles update inventory"
on public.inventory for update to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])))
with check ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Warehouse roles delete inventory"
on public.inventory for delete to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Active users read locations"
on public.locations for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Warehouse roles insert locations"
on public.locations for insert to authenticated
with check ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Warehouse roles update locations"
on public.locations for update to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])))
with check ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Admins delete locations"
on public.locations for delete to authenticated
using ((select private.has_role(array['admin']::text[])));

create policy "Active users read zones"
on public.zones for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Admins insert zones"
on public.zones for insert to authenticated
with check ((select private.has_role(array['admin']::text[])));

create policy "Admins update zones"
on public.zones for update to authenticated
using ((select private.has_role(array['admin']::text[])))
with check ((select private.has_role(array['admin']::text[])));

create policy "Admins delete zones"
on public.zones for delete to authenticated
using ((select private.has_role(array['admin']::text[])));

-- Stock movements are append-only for operational users.
create policy "Active users read stock movements"
on public.stock_movements for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Warehouse roles insert stock movements"
on public.stock_movements for insert to authenticated
with check ((select private.has_role(array['admin', 'lager']::text[])));

-- Activity is readable by active users and append-only for every active role.
create policy "Active users read activity log"
on public.activity_log for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Active users insert activity log"
on public.activity_log for insert to authenticated
with check (
  (select private.has_role(array['admin', 'lager']::text[]))
  and actor_id = (select auth.uid())
);

-- Data API privileges are a separate gate from RLS. Keep only operations that
-- have a matching policy, and expose nothing to anonymous clients.
revoke all on table public.profiles, public.inventory, public.locations,
  public.zones, public.stock_movements, public.activity_log from anon;

revoke all on table public.profiles, public.inventory, public.locations,
  public.zones, public.stock_movements, public.activity_log from authenticated;

grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.inventory to authenticated;
grant select, insert, update, delete on table public.locations to authenticated;
grant select, insert, update, delete on table public.zones to authenticated;
grant select, insert on table public.stock_movements to authenticated;
grant select, insert on table public.activity_log to authenticated;
