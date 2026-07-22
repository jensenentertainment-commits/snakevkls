-- Phase 6: remove redundant uniqueness constraints and cover foreign keys.
-- The retained *_key constraints enforce the same UNIQUE (code) invariant.
alter table public.locations
  drop constraint if exists locations_code_unique;

alter table public.zones
  drop constraint if exists zones_code_unique;

create index if not exists idx_inventory_zone_id
  on public.inventory using btree (zone_id);

create index if not exists idx_location_counts_inventory_id
  on public.location_counts using btree (inventory_id);

create index if not exists idx_location_counts_location_id
  on public.location_counts using btree (location_id);

create index if not exists idx_locations_zone_id
  on public.locations using btree (zone_id);

create index if not exists idx_stock_movements_inventory_id
  on public.stock_movements using btree (inventory_id);

create index if not exists idx_stock_movements_product_id
  on public.stock_movements using btree (product_id);
