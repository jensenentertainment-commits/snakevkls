-- Viper P1: minimal order-to-pick domain for the controlled warehouse pilot.
-- This phase deliberately excludes reservations, exceptions, fulfillment,
-- shipping, packing and Shopify order ingestion.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'shopify'
    check (source in ('shopify', 'manual')),
  external_order_id text not null,
  order_number text not null,
  status text not null default 'received'
    check (status in (
      'received', 'ready_to_pick', 'picking', 'picked', 'cancelled'
    )),
  external_updated_at timestamptz,
  received_at timestamptz not null default now(),
  ready_at timestamptz,
  picked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_source_external_order_id_key
    unique (source, external_order_id)
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  external_line_id text not null,
  product_id uuid references public.products(id) on delete restrict,
  shopify_variant_id text,
  sku text,
  product_name text not null,
  variant_name text,
  requested_quantity integer not null check (requested_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_lines_order_external_line_key
    unique (order_id, external_line_id)
);

create table public.pick_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique
    references public.orders(id) on delete restrict,
  status text not null default 'ready'
    check (status in ('ready', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid references auth.users(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pick_jobs_assignment_state_valid check (
    (status = 'ready' and assigned_to is null and started_at is null and completed_at is null)
    or
    (status = 'in_progress' and assigned_to is not null and started_at is not null and completed_at is null)
    or
    (status = 'completed' and assigned_to is not null and started_at is not null and completed_at is not null)
    or
    (status = 'cancelled' and completed_at is null)
  )
);

create table public.pick_lines (
  id uuid primary key default gen_random_uuid(),
  pick_job_id uuid not null references public.pick_jobs(id) on delete cascade,
  order_line_id uuid not null references public.order_lines(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  expected_quantity integer not null check (expected_quantity > 0),
  picked_quantity integer not null default 0 check (picked_quantity >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'picked', 'cancelled')),
  sequence_number integer not null check (sequence_number > 0),
  picked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pick_lines_job_inventory_key
    unique (pick_job_id, inventory_id),
  constraint pick_lines_job_sequence_key
    unique (pick_job_id, sequence_number),
  constraint pick_lines_quantity_state_valid check (
    (status = 'pending' and picked_quantity = 0 and picked_at is null)
    or
    (status = 'picked' and picked_quantity = expected_quantity and picked_at is not null)
    or
    (status = 'cancelled' and picked_quantity = 0)
  )
);

create table public.viper_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  occurred_at timestamptz not null default now(),
  order_id uuid references public.orders(id) on delete restrict,
  order_line_id uuid references public.order_lines(id) on delete restrict,
  pick_job_id uuid references public.pick_jobs(id) on delete restrict,
  pick_line_id uuid references public.pick_lines(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  actor_type text not null default 'user'
    check (actor_type in ('user', 'system', 'shopify')),
  correlation_id uuid not null,
  causation_id uuid references public.viper_events(id) on delete restrict,
  source text not null,
  schema_version integer not null default 1 check (schema_version > 0),
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object')
);

create index idx_order_lines_order_id
  on public.order_lines (order_id);
create index idx_order_lines_product_id
  on public.order_lines (product_id);
create index idx_orders_status_received_at
  on public.orders (status, received_at);
create index idx_pick_jobs_assigned_status
  on public.pick_jobs (assigned_to, status);
create index idx_pick_jobs_status_created_at
  on public.pick_jobs (status, created_at);
create index idx_pick_lines_inventory_id
  on public.pick_lines (inventory_id);
create index idx_pick_lines_job_status_sequence
  on public.pick_lines (pick_job_id, status, sequence_number);
create index idx_pick_lines_location_id
  on public.pick_lines (location_id);
create index idx_viper_events_order_occurred_at
  on public.viper_events (order_id, occurred_at);
create index idx_viper_events_pick_job_occurred_at
  on public.viper_events (pick_job_id, occurred_at);
create unique index viper_events_source_idempotency_key
  on public.viper_events (source, idempotency_key)
  where idempotency_key is not null;

-- The controlled pilot permits only one active Viper pick at a time. This is a
-- temporary safety invariant until reservations are introduced after the pilot.
create unique index pick_jobs_one_active_pilot_idx
  on public.pick_jobs ((true))
  where status = 'in_progress';

alter table public.stock_movements
  add column order_id uuid references public.orders(id) on delete restrict,
  add column pick_job_id uuid references public.pick_jobs(id) on delete restrict,
  add column pick_line_id uuid references public.pick_lines(id) on delete restrict;

alter table public.stock_movements
  drop constraint stock_movements_reason_check;

alter table public.stock_movements
  add constraint stock_movements_reason_check check (
    reason in (
      'manual_sale', 'waste', 'internal_use', 'correction',
      'receiving', 'other', 'viper_pick'
    )
  );

create index idx_stock_movements_order_id
  on public.stock_movements (order_id);
create index idx_stock_movements_pick_job_id
  on public.stock_movements (pick_job_id);
create index idx_stock_movements_pick_line_id
  on public.stock_movements (pick_line_id);

alter table public.activity_log
  drop constraint activity_log_entity_type_check;

alter table public.activity_log
  add constraint activity_log_entity_type_check check (
    entity_type = any (array[
      'product', 'inventory', 'location', 'zone', 'stock_movement',
      'shopify_sync', 'system', 'user', 'order', 'pick_job', 'pick_line'
    ])
  );

alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.pick_jobs enable row level security;
alter table public.pick_lines enable row level security;
alter table public.viper_events enable row level security;

-- P1 tables are readable by active warehouse roles, but never directly
-- writable through the Data API. Mutations go through server-authorized RPCs.
create policy "Active users read Viper orders"
on public.orders for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Active users read Viper order lines"
on public.order_lines for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Active users read Viper pick jobs"
on public.pick_jobs for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Active users read Viper pick lines"
on public.pick_lines for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

create policy "Active users read Viper events"
on public.viper_events for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

revoke all on table
  public.orders,
  public.order_lines,
  public.pick_jobs,
  public.pick_lines,
  public.viper_events
from public, anon, authenticated;

grant select on table
  public.orders,
  public.order_lines,
  public.pick_jobs,
  public.pick_lines,
  public.viper_events
to authenticated;

grant all privileges on table
  public.orders,
  public.order_lines,
  public.pick_jobs,
  public.pick_lines,
  public.viper_events
to service_role;

create or replace function public.start_viper_pick(
  requested_pick_job_id uuid,
  requested_actor_id uuid,
  requested_actor_email text default null,
  requested_actor_name text default null,
  requested_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_job public.pick_jobs%rowtype;
  current_order public.orders%rowtype;
  event_id uuid;
begin
  if requested_actor_id is null then
    raise exception 'Actor is required';
  end if;

  -- Serialize pilot claims so the partial unique index produces a clear,
  -- deterministic one-active-pick rule.
  perform pg_advisory_xact_lock(hashtextextended('viper_pilot_active_pick', 0));

  select * into current_job
  from public.pick_jobs
  where id = requested_pick_job_id
  for update;

  if not found then
    raise exception 'Pick job not found';
  end if;

  select * into current_order
  from public.orders
  where id = current_job.order_id
  for update;

  if current_job.status = 'in_progress'
    and current_job.assigned_to = requested_actor_id then
    return jsonb_build_object(
      'pickJobId', current_job.id,
      'orderId', current_order.id,
      'status', current_job.status,
      'startedAt', current_job.started_at,
      'idempotent', true
    );
  end if;

  if current_job.status <> 'ready'
    or current_order.status <> 'ready_to_pick' then
    raise exception 'Pick job is not ready';
  end if;

  if exists (
    select 1 from public.pick_jobs
    where status = 'in_progress'
      and id <> current_job.id
  ) then
    raise exception 'Another pilot pick is already active';
  end if;

  if not exists (
    select 1 from public.pick_lines
    where pick_job_id = current_job.id
  ) then
    raise exception 'Pick job has no lines';
  end if;

  if exists (
    select 1
    from public.pick_lines as pick_line
    join public.order_lines as order_line
      on order_line.id = pick_line.order_line_id
    join public.inventory as inventory
      on inventory.id = pick_line.inventory_id
    where pick_line.pick_job_id = current_job.id
      and (
        order_line.order_id <> current_order.id
        or order_line.product_id is null
        or order_line.product_id <> pick_line.product_id
        or inventory.product_id <> pick_line.product_id
        or inventory.location_id is distinct from pick_line.location_id
      )
  ) then
    raise exception 'Pick job contains inconsistent lines';
  end if;

  update public.pick_jobs
  set status = 'in_progress',
      assigned_to = requested_actor_id,
      started_at = now(),
      updated_at = now()
  where id = current_job.id
  returning * into current_job;

  update public.orders
  set status = 'picking',
      updated_at = now()
  where id = current_order.id;

  insert into public.viper_events (
    event_type, order_id, pick_job_id, actor_id, actor_type,
    correlation_id, source, payload
  ) values (
    'pick_started', current_order.id, current_job.id,
    requested_actor_id, 'user', requested_correlation_id, 'viper',
    jsonb_build_object(
      'orderNumber', current_order.order_number,
      'assignedTo', requested_actor_id
    )
  ) returning id into event_id;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'pick_job', current_job.id, 'viper_pick_started',
    'Plukk startet', 'Ordre ' || current_order.order_number,
    jsonb_build_object(
      'orderId', current_order.id,
      'orderNumber', current_order.order_number,
      'pickJobId', current_job.id,
      'eventId', event_id,
      'correlationId', requested_correlation_id
    ),
    requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'pickJobId', current_job.id,
    'orderId', current_order.id,
    'status', current_job.status,
    'startedAt', current_job.started_at,
    'idempotent', false
  );
end;
$$;

create or replace function public.confirm_viper_pick_line(
  requested_pick_line_id uuid,
  requested_actor_id uuid,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_line public.pick_lines%rowtype;
  current_job public.pick_jobs%rowtype;
  current_order_id uuid;
begin
  if requested_actor_id is null or requested_correlation_id is null then
    raise exception 'Actor and correlation ID are required';
  end if;

  select * into current_line
  from public.pick_lines
  where id = requested_pick_line_id
  for update;

  if not found then
    raise exception 'Pick line not found';
  end if;

  select * into current_job
  from public.pick_jobs
  where id = current_line.pick_job_id
  for update;

  select order_id into current_order_id
  from public.pick_jobs
  where id = current_job.id;

  if current_job.status <> 'in_progress'
    or current_job.assigned_to <> requested_actor_id then
    raise exception 'Pick job is not assigned to actor';
  end if;

  if current_line.status = 'picked' then
    return jsonb_build_object(
      'pickLineId', current_line.id,
      'pickJobId', current_job.id,
      'status', current_line.status,
      'pickedQuantity', current_line.picked_quantity,
      'idempotent', true
    );
  end if;

  if current_line.status <> 'pending' then
    raise exception 'Pick line cannot be confirmed';
  end if;

  update public.pick_lines
  set status = 'picked',
      picked_quantity = expected_quantity,
      picked_at = now(),
      updated_at = now()
  where id = current_line.id
  returning * into current_line;

  insert into public.viper_events (
    event_type, order_id, order_line_id, pick_job_id, pick_line_id,
    actor_id, actor_type, correlation_id, source, payload
  ) values (
    'pick_line_completed', current_order_id, current_line.order_line_id,
    current_job.id, current_line.id, requested_actor_id, 'user',
    requested_correlation_id, 'viper',
    jsonb_build_object(
      'productId', current_line.product_id,
      'inventoryId', current_line.inventory_id,
      'locationId', current_line.location_id,
      'pickedQuantity', current_line.picked_quantity
    )
  );

  return jsonb_build_object(
    'pickLineId', current_line.id,
    'pickJobId', current_job.id,
    'status', current_line.status,
    'pickedQuantity', current_line.picked_quantity,
    'idempotent', false
  );
end;
$$;

create or replace function public.complete_viper_pick(
  requested_pick_job_id uuid,
  requested_actor_id uuid,
  requested_actor_email text default null,
  requested_actor_name text default null,
  requested_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_job public.pick_jobs%rowtype;
  current_order public.orders%rowtype;
  line record;
  current_inventory public.inventory%rowtype;
  movement_id uuid;
  event_id uuid;
begin
  if requested_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select * into current_job
  from public.pick_jobs
  where id = requested_pick_job_id
  for update;

  if not found then
    raise exception 'Pick job not found';
  end if;

  select * into current_order
  from public.orders
  where id = current_job.order_id
  for update;

  if current_job.status = 'completed'
    and current_order.status = 'picked' then
    return jsonb_build_object(
      'pickJobId', current_job.id,
      'orderId', current_order.id,
      'status', current_job.status,
      'completedAt', current_job.completed_at,
      'idempotent', true
    );
  end if;

  if current_job.status <> 'in_progress'
    or current_job.assigned_to <> requested_actor_id
    or current_order.status <> 'picking' then
    raise exception 'Pick job cannot be completed by actor';
  end if;

  if exists (
    select 1 from public.pick_lines
    where pick_job_id = current_job.id
      and status <> 'picked'
  ) then
    raise exception 'All pick lines must be completed';
  end if;

  if not exists (
    select 1 from public.pick_lines
    where pick_job_id = current_job.id
  ) then
    raise exception 'Pick job has no lines';
  end if;

  -- Lock and validate all inventory rows in deterministic order before the
  -- first update. Any error rolls the entire function back.
  for line in
    select pick_line.*
    from public.pick_lines as pick_line
    where pick_line.pick_job_id = current_job.id
    order by pick_line.inventory_id, pick_line.id
  loop
    select * into current_inventory
    from public.inventory
    where id = line.inventory_id
    for update;

    if not found
      or current_inventory.product_id <> line.product_id
      or current_inventory.location_id is distinct from line.location_id then
      raise exception 'Pick line inventory no longer matches';
    end if;

    if current_inventory.quantity < line.picked_quantity then
      raise exception 'Insufficient inventory to complete pick';
    end if;
  end loop;

  for line in
    select pick_line.*
    from public.pick_lines as pick_line
    where pick_line.pick_job_id = current_job.id
    order by pick_line.inventory_id, pick_line.id
  loop
    update public.inventory
    set quantity = quantity - line.picked_quantity,
        updated_at = now()
    where id = line.inventory_id
    returning * into current_inventory;

    insert into public.stock_movements (
      product_id, inventory_id, quantity_delta, reason, note,
      order_id, pick_job_id, pick_line_id
    ) values (
      line.product_id, line.inventory_id, -line.picked_quantity,
      'viper_pick', 'Viper-plukk fullført',
      current_order.id, current_job.id, line.id
    ) returning id into movement_id;
  end loop;

  update public.pick_jobs
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = current_job.id
  returning * into current_job;

  update public.orders
  set status = 'picked',
      picked_at = current_job.completed_at,
      updated_at = now()
  where id = current_order.id
  returning * into current_order;

  insert into public.viper_events (
    event_type, order_id, pick_job_id, actor_id, actor_type,
    correlation_id, source, payload
  ) values (
    'pick_completed', current_order.id, current_job.id,
    requested_actor_id, 'user', requested_correlation_id, 'viper',
    jsonb_build_object(
      'orderNumber', current_order.order_number,
      'completedAt', current_job.completed_at
    )
  ) returning id into event_id;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'pick_job', current_job.id, 'viper_pick_completed',
    'Plukk fullført', 'Ordre ' || current_order.order_number,
    jsonb_build_object(
      'orderId', current_order.id,
      'orderNumber', current_order.order_number,
      'pickJobId', current_job.id,
      'eventId', event_id,
      'correlationId', requested_correlation_id
    ),
    requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'pickJobId', current_job.id,
    'orderId', current_order.id,
    'status', current_job.status,
    'completedAt', current_job.completed_at,
    'idempotent', false
  );
end;
$$;

revoke all on function public.start_viper_pick(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.confirm_viper_pick_line(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_viper_pick(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.start_viper_pick(uuid, uuid, text, text, uuid)
  to service_role;
grant execute on function public.confirm_viper_pick_line(uuid, uuid, uuid)
  to service_role;
grant execute on function public.complete_viper_pick(uuid, uuid, text, text, uuid)
  to service_role;
