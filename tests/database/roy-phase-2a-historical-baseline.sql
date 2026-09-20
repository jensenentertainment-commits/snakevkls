\ir roy-phase-2a-acceptance.guard.sql
-- Acceptance-only operational baseline. The next historical migration owns
-- priority assignment; production identifiers and names are not reproduced.
begin;
lock table public.zones in exclusive mode;
do $$ begin
  if exists (select 1 from public.zones) then
    raise exception 'Historical acceptance baseline requires empty zones';
  end if;
end; $$;
insert into public.zones (code, name, active) values
  ('HL', 'Acceptance fixture HL', true),
  ('ML', 'Acceptance fixture ML', true),
  ('SL', 'Acceptance fixture SL', true);
commit;
