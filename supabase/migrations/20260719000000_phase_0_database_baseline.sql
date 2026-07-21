-- Phase 0: reproduce the application-owned schema that predates migrations.
-- Later migrations remain responsible for Phase 1-3 behavior.

create table if not exists public.products (
  id uuid not null default gen_random_uuid(),
  sku text,
  product_name text not null,
  variant_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shopify_product_id text,
  shopify_variant_id text,
  shopify_inventory_item_id text,
  shopify_status text,
  synced_at timestamptz,
  image_url text,
  vendor text,
  product_type text,
  collections text[],
  shopify_quantity integer default 0,
  constraint products_pkey primary key (id),
  constraint products_sku_key unique (sku)
);

create table if not exists public.profiles (
  id uuid not null,
  email text,
  role text not null default 'lager',
  created_at timestamptz not null default now(),
  display_name text,
  active boolean not null default true,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id)
    references auth.users(id) on delete cascade,
  constraint profiles_role_valid check (role in ('admin', 'lager'))
);

create table if not exists public.zones (
  id uuid not null default gen_random_uuid(),
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zones_pkey primary key (id),
  constraint zones_code_key unique (code)
);

create table if not exists public.locations (
  id uuid not null default gen_random_uuid(),
  code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  zone_id uuid,
  constraint locations_pkey primary key (id),
  constraint locations_code_key unique (code),
  constraint locations_zone_id_fkey foreign key (zone_id)
    references public.zones(id) on delete set null
);

create table if not exists public.inventory (
  id uuid not null default gen_random_uuid(),
  product_id uuid not null,
  location_id uuid,
  quantity integer not null default 0,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  zone_id uuid,
  constraint inventory_pkey primary key (id),
  constraint inventory_product_id_fkey foreign key (product_id)
    references public.products(id) on delete cascade,
  constraint inventory_location_id_fkey foreign key (location_id)
    references public.locations(id) on delete cascade,
  constraint inventory_zone_id_fkey foreign key (zone_id)
    references public.zones(id),
  constraint inventory_quantity_non_negative check (quantity >= 0)
);

create table if not exists public.stock_movements (
  id uuid not null default gen_random_uuid(),
  product_id uuid not null,
  inventory_id uuid,
  quantity_delta integer not null,
  reason text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint stock_movements_pkey primary key (id),
  constraint stock_movements_product_id_fkey foreign key (product_id)
    references public.products(id) on delete cascade,
  constraint stock_movements_inventory_id_fkey foreign key (inventory_id)
    references public.inventory(id) on delete set null,
  constraint stock_movements_quantity_delta_not_zero
    check (quantity_delta <> 0),
  constraint stock_movements_reason_check check (
    reason in ('manual_sale', 'waste', 'internal_use', 'correction', 'receiving', 'other')
  )
);

create table if not exists public.activity_log (
  id uuid not null default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  title text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  actor_name text,
  constraint activity_log_pkey primary key (id),
  constraint activity_log_entity_type_check check (
    entity_type in (
      'product', 'inventory', 'location', 'zone', 'stock_movement',
      'shopify_sync', 'system', 'user'
    )
  )
);

create table if not exists public.product_collections (
  id uuid not null default gen_random_uuid(),
  product_id uuid not null,
  shopify_collection_id text not null,
  title text not null,
  handle text,
  created_at timestamptz not null default now(),
  constraint product_collections_pkey primary key (id),
  constraint product_collections_product_id_fkey foreign key (product_id)
    references public.products(id) on delete cascade,
  constraint product_collections_product_id_shopify_collection_id_key
    unique (product_id, shopify_collection_id)
);

create table if not exists public.shopify_connections (
  id uuid not null default gen_random_uuid(),
  shop text not null,
  access_token text not null,
  scopes text,
  installed_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint shopify_connections_pkey primary key (id),
  constraint shopify_connections_shop_key unique (shop)
);

create table if not exists public.snakeboard_messages (
  id uuid not null default gen_random_uuid(),
  title text not null,
  body text,
  type text not null default 'info',
  status text not null default 'active',
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  constraint snakeboard_messages_pkey primary key (id),
  constraint snakeboard_messages_type_check
    check (type in ('info', 'important', 'issue')),
  constraint snakeboard_messages_status_check
    check (status in ('active', 'archived'))
);

create table if not exists public.location_counts (
  id uuid not null default gen_random_uuid(),
  location_id uuid not null,
  inventory_id uuid not null,
  expected_quantity integer not null default 0,
  counted_quantity integer not null default 0,
  difference integer generated always as
    (counted_quantity - expected_quantity) stored,
  note text,
  counted_by uuid,
  counted_by_name text,
  counted_at timestamptz not null default now(),
  constraint location_counts_pkey primary key (id),
  constraint location_counts_location_id_fkey foreign key (location_id)
    references public.locations(id),
  constraint location_counts_inventory_id_fkey foreign key (inventory_id)
    references public.inventory(id)
);

-- These duplicate named constraints both exist in production. Add the second
-- constraint separately because PostgreSQL deduplicates identical constraints
-- declared together in a single CREATE TABLE statement.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.zones'::regclass
      and conname = 'zones_code_unique'
  ) then
    alter table public.zones
      add constraint zones_code_unique unique (code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.locations'::regclass
      and conname = 'locations_code_unique'
  ) then
    alter table public.locations
      add constraint locations_code_unique unique (code);
  end if;
end;
$$;

create index if not exists idx_inventory_location_id
  on public.inventory using btree (location_id);
create unique index if not exists idx_inventory_one_row_per_product_location
  on public.inventory using btree (product_id, location_id);
create index if not exists idx_inventory_product_id
  on public.inventory using btree (product_id);
create unique index if not exists inventory_one_primary_per_product
  on public.inventory using btree (product_id) where is_primary = true;

create index if not exists product_collections_handle_idx
  on public.product_collections using btree (handle);
create index if not exists product_collections_product_id_idx
  on public.product_collections using btree (product_id);

create index if not exists idx_products_name
  on public.products using btree (product_name);
create index if not exists idx_products_sku
  on public.products using btree (sku);
create unique index if not exists products_sku_unique
  on public.products using btree (sku) where sku is not null;

alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.zones enable row level security;
alter table public.locations enable row level security;
alter table public.inventory enable row level security;
alter table public.stock_movements enable row level security;
alter table public.activity_log enable row level security;
alter table public.product_collections enable row level security;
alter table public.shopify_connections enable row level security;
alter table public.snakeboard_messages enable row level security;
alter table public.location_counts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'Authenticated read products'
  ) then
    create policy "Authenticated read products"
    on public.products for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'product_collections'
      and policyname = 'Authenticated read product collections'
  ) then
    create policy "Authenticated read product collections"
    on public.product_collections for select to authenticated using (true);
  end if;
end;
$$;

grant all privileges on table
  public.products,
  public.profiles,
  public.zones,
  public.locations,
  public.inventory,
  public.stock_movements,
  public.activity_log,
  public.product_collections,
  public.shopify_connections,
  public.snakeboard_messages,
  public.location_counts
to service_role;

grant all privileges on table
  public.products,
  public.product_collections,
  public.shopify_connections,
  public.snakeboard_messages,
  public.location_counts
to anon, authenticated;
