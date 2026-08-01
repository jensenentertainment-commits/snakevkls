-- Warehouse sales Phase 2: immutable completed-sale records and a
-- transactional outbox. No completion or worker RPC is introduced here.

create sequence public.warehouse_sale_number_seq
  as bigint
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create table public.warehouse_sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  status text not null default 'completed'
    check (status = 'completed'),
  payment_method text not null default 'vipps'
    check (payment_method ~ '^[a-z][a-z0-9_]*$'),
  currency text not null default 'NOK'
    check (currency ~ '^[A-Z]{3}$'),
  total_amount_minor bigint not null
    check (total_amount_minor >= 0),
  total_quantity integer not null
    check (total_quantity > 0),
  line_count integer not null
    check (line_count > 0),
  completed_at timestamptz not null,
  completed_by uuid not null
    references auth.users(id) on delete restrict,
  completed_by_name text not null
    check (nullif(btrim(completed_by_name), '') is not null),
  idempotency_key uuid not null unique,
  request_hash text not null
    check (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint warehouse_sales_number_format check (
    sale_number ~ '^LS-[0-9]{4}-[0-9]{8}$'
  ),
  constraint warehouse_sales_completed_time_valid check (
    completed_at >= created_at
  )
);

create table public.warehouse_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null
    references public.warehouse_sales(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  product_id uuid not null
    references public.products(id) on delete restrict,
  sku text,
  product_name text not null
    check (nullif(btrim(product_name), '') is not null),
  variant_name text,
  standard_unit_price_minor bigint not null
    check (standard_unit_price_minor >= 0),
  unit_price_minor bigint not null
    check (unit_price_minor >= 0),
  quantity integer not null check (quantity > 0),
  line_total_minor bigint generated always as (
    unit_price_minor * quantity::bigint
  ) stored,
  price_overridden boolean generated always as (
    unit_price_minor <> standard_unit_price_minor
  ) stored,
  created_at timestamptz not null default now(),
  constraint warehouse_sale_lines_sale_line_key
    unique (sale_id, line_number),
  constraint warehouse_sale_lines_sale_product_key
    unique (sale_id, product_id),
  constraint warehouse_sale_lines_sale_id_id_key
    unique (sale_id, id)
);

create table public.warehouse_sale_shopify_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  warehouse_sale_id uuid not null unique
    references public.warehouse_sales(id) on delete restrict,
  shop text not null
    check (nullif(btrim(shop), '') is not null),
  shopify_location_id text not null
    check (
      shopify_location_id ~ '^gid://shopify/Location/[0-9]+$'
    ),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'synced', 'failed')),
  idempotency_key uuid not null,
  reference_document_uri text not null
    check (nullif(btrim(reference_document_uri), '') is not null),
  payload jsonb not null,
  payload_hash text not null
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  next_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_attempt_at timestamptz,
  synced_at timestamptz,
  shopify_adjustment_group_id text,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_sale_shopify_jobs_idempotency_key
    unique (shop, idempotency_key),
  constraint warehouse_sale_shopify_jobs_payload_valid check (
    jsonb_typeof(payload) = 'object'
    and payload @> '{"schemaVersion": 1}'::jsonb
    and payload ->> 'locationId' = shopify_location_id
    and case
      when jsonb_typeof(payload -> 'changes') = 'array'
      then jsonb_array_length(payload -> 'changes') > 0
      else false
    end
  ),
  constraint warehouse_sale_shopify_jobs_lease_pair check (
    num_nonnulls(lease_token, lease_expires_at) in (0, 2)
  ),
  constraint warehouse_sale_shopify_jobs_state_valid check (
    (
      status = 'pending'
      and lease_token is null
      and lease_expires_at is null
      and synced_at is null
      and shopify_adjustment_group_id is null
    )
    or
    (
      status = 'processing'
      and attempt_count > 0
      and lease_token is not null
      and lease_expires_at is not null
      and last_attempt_at is not null
      and synced_at is null
      and shopify_adjustment_group_id is null
    )
    or
    (
      status = 'synced'
      and attempt_count > 0
      and lease_token is null
      and lease_expires_at is null
      and next_attempt_at is null
      and synced_at is not null
      and nullif(btrim(shopify_adjustment_group_id), '') is not null
      and last_error_code is null
      and last_error_message is null
    )
    or
    (
      status = 'failed'
      and attempt_count > 0
      and lease_token is null
      and lease_expires_at is null
      and last_attempt_at is not null
      and synced_at is null
      and shopify_adjustment_group_id is null
      and nullif(btrim(last_error_message), '') is not null
    )
  )
);

create index warehouse_sales_completed_at_idx
  on public.warehouse_sales (completed_at desc, id desc);

create index warehouse_sales_completed_by_idx
  on public.warehouse_sales (completed_by, completed_at desc);

create index warehouse_sale_lines_product_id_idx
  on public.warehouse_sale_lines (product_id);

create index warehouse_sale_shopify_jobs_ready_idx
  on public.warehouse_sale_shopify_sync_jobs (
    status,
    next_attempt_at,
    created_at
  )
  where status in ('pending', 'failed');

create index warehouse_sale_shopify_jobs_expired_lease_idx
  on public.warehouse_sale_shopify_sync_jobs (lease_expires_at)
  where status = 'processing';

alter table public.stock_movements
  add column warehouse_sale_id uuid
    references public.warehouse_sales(id) on delete restrict,
  add column warehouse_sale_line_id uuid,
  add constraint stock_movements_warehouse_sale_line_fkey
    foreign key (warehouse_sale_id, warehouse_sale_line_id)
    references public.warehouse_sale_lines(sale_id, id)
    on delete restrict;

create index stock_movements_warehouse_sale_id_idx
  on public.stock_movements (warehouse_sale_id)
  where warehouse_sale_id is not null;

create index stock_movements_warehouse_sale_line_id_idx
  on public.stock_movements (warehouse_sale_line_id)
  where warehouse_sale_line_id is not null;

alter table public.stock_movements
  add constraint stock_movements_warehouse_sale_refs_valid check (
    (
      reason <> 'warehouse_sale'
      and warehouse_sale_id is null
      and warehouse_sale_line_id is null
    )
    or
    (
      reason = 'warehouse_sale'
      and warehouse_sale_id is not null
      and warehouse_sale_line_id is not null
    )
  );

alter table public.stock_movements
  drop constraint stock_movements_reason_check;

alter table public.stock_movements
  add constraint stock_movements_reason_check check (
    reason in (
      'manual_sale', 'waste', 'internal_use', 'correction',
      'receiving', 'other', 'viper_pick', 'warehouse_sale'
    )
  );

alter table public.activity_log
  drop constraint activity_log_entity_type_check;

alter table public.activity_log
  add constraint activity_log_entity_type_check check (
    entity_type = any (array[
      'product', 'inventory', 'location', 'zone', 'stock_movement',
      'shopify_sync', 'system', 'user', 'order', 'pick_job', 'pick_line',
      'warehouse_sale'
    ])
  );

create or replace function private.reject_warehouse_sale_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Completed warehouse sale records are immutable';
end;
$$;

create or replace function private.protect_warehouse_sale_shopify_job_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.warehouse_sale_id is distinct from old.warehouse_sale_id
    or new.shop is distinct from old.shop
    or new.shopify_location_id is distinct from old.shopify_location_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.reference_document_uri is distinct from old.reference_document_uri
    or new.payload is distinct from old.payload
    or new.payload_hash is distinct from old.payload_hash
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Warehouse sale Shopify job identity is immutable';
  end if;

  return new;
end;
$$;

create trigger warehouse_sales_immutable
before update or delete on public.warehouse_sales
for each row execute function private.reject_warehouse_sale_mutation();

create trigger warehouse_sale_lines_immutable
before update or delete on public.warehouse_sale_lines
for each row execute function private.reject_warehouse_sale_mutation();

create trigger warehouse_sale_shopify_job_identity_immutable
before update on public.warehouse_sale_shopify_sync_jobs
for each row execute function
  private.protect_warehouse_sale_shopify_job_identity();

revoke all on function private.reject_warehouse_sale_mutation()
  from public, anon, authenticated;
revoke all on function
  private.protect_warehouse_sale_shopify_job_identity()
  from public, anon, authenticated;

alter table public.warehouse_sales enable row level security;
alter table public.warehouse_sale_lines enable row level security;
alter table public.warehouse_sale_shopify_sync_jobs
  enable row level security;

create policy "Active users read warehouse sales"
on public.warehouse_sales
for select
to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Active users read warehouse sale lines"
on public.warehouse_sale_lines
for select
to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Active users read warehouse sale Shopify jobs"
on public.warehouse_sale_shopify_sync_jobs
for select
to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

revoke all on table
  public.warehouse_sales,
  public.warehouse_sale_lines,
  public.warehouse_sale_shopify_sync_jobs
from public, anon, authenticated;

grant select on table
  public.warehouse_sales,
  public.warehouse_sale_lines,
  public.warehouse_sale_shopify_sync_jobs
to authenticated;

grant all privileges on table
  public.warehouse_sales,
  public.warehouse_sale_lines,
  public.warehouse_sale_shopify_sync_jobs
to service_role;

revoke all on sequence public.warehouse_sale_number_seq
  from public, anon, authenticated;
grant usage, select on sequence public.warehouse_sale_number_seq
  to service_role;
