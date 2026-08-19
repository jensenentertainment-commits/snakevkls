-- Future Foundation v1: physical pick order is explicit data, never inferred
-- from a location code or from Shopify order-line order.

alter table public.zones
  add column pick_priority integer;

update public.zones
set pick_priority = case code
  when 'HL' then 1
  when 'ME' then 2
  when 'ML' then 3
  when 'SL' then 4
end;

do $$
begin
  if exists (select 1 from public.zones where pick_priority is null) then
    raise exception 'Every existing zone needs an explicit pick priority';
  end if;
end;
$$;

alter table public.zones
  alter column pick_priority set not null,
  add constraint zones_pick_priority_positive check (pick_priority > 0),
  add constraint zones_pick_priority_key unique (pick_priority);

alter table public.locations
  add column pick_sequence integer,
  add constraint locations_pick_sequence_positive
    check (pick_sequence is null or pick_sequence > 0),
  add constraint locations_pick_sequence_requires_zone
    check (pick_sequence is null or zone_id is not null);

create unique index locations_zone_pick_sequence_key
  on public.locations (zone_id, pick_sequence)
  where pick_sequence is not null;

comment on column public.zones.pick_priority is
  'Explicit cross-zone pick order. Lower values are picked first.';
comment on column public.locations.pick_sequence is
  'Natural physical pick order within a zone. Independent of location code.';
