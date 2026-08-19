-- Role Model contract phase.
-- This migration is intentionally non-destructive to profiles: production
-- profile classification must be complete before the legacy role is removed.

do $$
begin
  if exists (select 1 from public.profiles where role = 'lager') then
    raise exception 'Contract blocked: legacy lager profiles still exist';
  end if;

  if exists (
    select 1
    from public.profiles
    where role not in ('admin', 'user', 'warehouse')
  ) then
    raise exception 'Contract blocked: profile with unknown role exists';
  end if;
end
$$;

alter table public.profiles
  drop constraint if exists profiles_role_valid;

alter table public.profiles
  add constraint profiles_role_valid check (
    role in ('admin', 'user', 'warehouse')
  );

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
      and profile.role = any (
        array['admin', 'user', 'warehouse']::text[]
      )
  );
$$;

revoke all on function private.has_role(text[]) from public, anon;
grant execute on function private.has_role(text[]) to authenticated;

drop policy if exists "Active users read own profile" on public.profiles;
create policy "Active users read own profile"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  and active is true
  and role in ('admin', 'user', 'warehouse')
);

drop policy if exists "Active roles read products" on public.products;
create policy "Active roles read products"
on public.products for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));

drop policy if exists "Active roles read product collections" on public.product_collections;
create policy "Active roles read product collections"
on public.product_collections for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));

drop policy if exists "Operational roles read inventory" on public.inventory;
drop policy if exists "Operational roles insert inventory" on public.inventory;
drop policy if exists "Operational roles update inventory" on public.inventory;
drop policy if exists "Operational roles delete inventory" on public.inventory;
create policy "Operational roles read inventory"
on public.inventory for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles insert inventory"
on public.inventory for insert to authenticated
with check ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles update inventory"
on public.inventory for update to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])))
with check ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles delete inventory"
on public.inventory for delete to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));

drop policy if exists "Operational roles read locations" on public.locations;
drop policy if exists "Operational roles insert locations" on public.locations;
drop policy if exists "Operational roles update locations" on public.locations;
create policy "Operational roles read locations"
on public.locations for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles insert locations"
on public.locations for insert to authenticated
with check ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles update locations"
on public.locations for update to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])))
with check ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));

drop policy if exists "Operational roles read zones" on public.zones;
create policy "Operational roles read zones"
on public.zones for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));

drop policy if exists "Operational roles read stock movements" on public.stock_movements;
drop policy if exists "Operational roles insert stock movements" on public.stock_movements;
create policy "Operational roles read stock movements"
on public.stock_movements for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles insert stock movements"
on public.stock_movements for insert to authenticated
with check ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));

drop policy if exists "Operational roles read activity log" on public.activity_log;
drop policy if exists "Operational roles insert activity log" on public.activity_log;
create policy "Operational roles read activity log"
on public.activity_log for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles insert activity log"
on public.activity_log for insert to authenticated
with check (
  (select private.has_role(array['admin', 'user', 'warehouse']::text[]))
  and actor_id = (select auth.uid())
);

drop policy if exists "Operational roles read Viper orders" on public.orders;
drop policy if exists "Operational roles read Viper order lines" on public.order_lines;
drop policy if exists "Operational roles read Viper pick jobs" on public.pick_jobs;
drop policy if exists "Operational roles read Viper pick lines" on public.pick_lines;
drop policy if exists "Operational roles read Viper events" on public.viper_events;
drop policy if exists "Operational roles read Viper pick exceptions" on public.pick_exceptions;
create policy "Operational roles read Viper orders"
on public.orders for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles read Viper order lines"
on public.order_lines for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles read Viper pick jobs"
on public.pick_jobs for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles read Viper pick lines"
on public.pick_lines for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles read Viper events"
on public.viper_events for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));
create policy "Operational roles read Viper pick exceptions"
on public.pick_exceptions for select to authenticated
using ((select private.has_role(array['admin', 'user', 'warehouse']::text[])));

drop policy if exists "Business roles read warehouse sales" on public.warehouse_sales;
drop policy if exists "Business roles read warehouse sale lines" on public.warehouse_sale_lines;
drop policy if exists "Business roles read warehouse sale Shopify jobs"
  on public.warehouse_sale_shopify_sync_jobs;
create policy "Business roles read warehouse sales"
on public.warehouse_sales for select to authenticated
using ((select private.has_role(array['admin', 'user']::text[])));
create policy "Business roles read warehouse sale lines"
on public.warehouse_sale_lines for select to authenticated
using ((select private.has_role(array['admin', 'user']::text[])));
create policy "Business roles read warehouse sale Shopify jobs"
on public.warehouse_sale_shopify_sync_jobs for select to authenticated
using ((select private.has_role(array['admin', 'user']::text[])));

-- Keep the proven implementation byte-for-byte except for its actor role list.
-- Abort if the expected expand definition is not present.
do $$
declare
  function_oid oid := 'public.complete_warehouse_sale(uuid,text,text,jsonb,text,uuid,text,text)'::regprocedure::oid;
  definition text;
  contracted_definition text;
begin
  definition := pg_get_functiondef(function_oid);

  if position('profile.role in (''admin'', ''user'', ''lager'')' in definition) = 0 then
    raise exception 'Contract blocked: unexpected complete_warehouse_sale definition';
  end if;

  contracted_definition := replace(
    definition,
    'profile.role in (''admin'', ''user'', ''lager'')',
    'profile.role in (''admin'', ''user'')'
  );

  if contracted_definition like '%''lager''%' then
    raise exception 'Contract blocked: complete_warehouse_sale still contains legacy role';
  end if;

  execute contracted_definition;
end
$$;

revoke all on function public.complete_warehouse_sale(
  uuid, text, text, jsonb, text, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.complete_warehouse_sale(
  uuid, text, text, jsonb, text, uuid, text, text
) to service_role;
