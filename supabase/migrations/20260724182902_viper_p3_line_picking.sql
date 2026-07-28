-- Viper P3: mobile line picking and narrowly scoped pick exceptions.
-- Shopify, reservations and the warehouse ownership contract are unchanged.

alter table public.pick_lines
  add column picked_by uuid references auth.users(id) on delete restrict;

create table public.pick_exceptions (
  id uuid primary key default gen_random_uuid(),
  pick_job_id uuid not null references public.pick_jobs(id) on delete restrict,
  pick_line_id uuid not null references public.pick_lines(id) on delete restrict,
  exception_type text not null
    check (exception_type in ('item_not_found', 'wrong_quantity', 'damaged')),
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  observed_quantity integer check (observed_quantity >= 0),
  note text,
  reported_by uuid not null references auth.users(id) on delete restrict,
  reported_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pick_exceptions_resolution_state_valid check (
    (
      status = 'open'
      and resolved_by is null
      and resolved_at is null
      and resolution_note is null
    )
    or
    (
      status = 'resolved'
      and resolved_by is not null
      and resolved_at is not null
      and nullif(btrim(resolution_note), '') is not null
    )
  )
);

create unique index pick_exceptions_one_open_per_line_idx
  on public.pick_exceptions (pick_line_id)
  where status = 'open';
create index idx_pick_exceptions_job_status
  on public.pick_exceptions (pick_job_id, status, reported_at);
create index idx_pick_exceptions_line_status
  on public.pick_exceptions (pick_line_id, status);

alter table public.viper_events
  add column exception_id uuid
    references public.pick_exceptions(id) on delete restrict;
create index idx_viper_events_exception_sequence
  on public.viper_events (exception_id, event_sequence);

alter table public.pick_exceptions enable row level security;

create policy "Active users read Viper pick exceptions"
on public.pick_exceptions for select to authenticated
using ((select private.has_role(array['admin', 'lager']::text[])));

revoke all on table public.pick_exceptions
  from public, anon, authenticated;
grant select on table public.pick_exceptions to authenticated;
grant all privileges on table public.pick_exceptions to service_role;

create or replace function public.report_viper_pick_exception(
  requested_pick_line_id uuid,
  requested_exception_type text,
  requested_observed_quantity integer,
  requested_note text,
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
  current_line public.pick_lines%rowtype;
  current_job public.pick_jobs%rowtype;
  current_exception public.pick_exceptions%rowtype;
  current_order public.orders%rowtype;
  event_id uuid;
begin
  if requested_actor_id is null or requested_correlation_id is null then
    raise exception 'Actor and correlation ID are required';
  end if;
  if requested_exception_type not in (
    'item_not_found', 'wrong_quantity', 'damaged'
  ) then
    raise exception 'Invalid pick exception type';
  end if;
  if requested_observed_quantity is not null
    and requested_observed_quantity < 0 then
    raise exception 'Observed quantity cannot be negative';
  end if;

  select * into current_line
  from public.pick_lines
  where id = requested_pick_line_id
  for update;
  if not found then raise exception 'Pick line not found'; end if;

  select * into current_job
  from public.pick_jobs
  where id = current_line.pick_job_id
  for update;

  if current_job.status <> 'in_progress'
    or current_job.assigned_to <> requested_actor_id then
    raise exception 'Pick job is not assigned to actor';
  end if;
  if current_line.status <> 'pending' then
    raise exception 'Pick line cannot receive an exception';
  end if;

  select * into current_exception
  from public.pick_exceptions
  where pick_line_id = current_line.id and status = 'open'
  for update;

  if found then
    return jsonb_build_object(
      'exceptionId', current_exception.id,
      'pickJobId', current_exception.pick_job_id,
      'pickLineId', current_exception.pick_line_id,
      'status', current_exception.status,
      'idempotent', true
    );
  end if;

  select * into current_order
  from public.orders
  where id = current_job.order_id;

  insert into public.pick_exceptions (
    pick_job_id, pick_line_id, exception_type, observed_quantity, note,
    reported_by
  ) values (
    current_job.id, current_line.id, requested_exception_type,
    requested_observed_quantity, nullif(btrim(requested_note), ''),
    requested_actor_id
  ) returning * into current_exception;

  insert into public.viper_events (
    event_type, order_id, order_line_id, pick_job_id, pick_line_id,
    exception_id, actor_id, actor_type, correlation_id, source, payload
  ) values (
    'pick_exception_reported', current_order.id, current_line.order_line_id,
    current_job.id, current_line.id, current_exception.id,
    requested_actor_id, 'user', requested_correlation_id, 'viper',
    jsonb_build_object(
      'exceptionType', current_exception.exception_type,
      'observedQuantity', current_exception.observed_quantity,
      'note', current_exception.note
    )
  ) returning id into event_id;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'pick_line', current_line.id, 'viper_pick_exception_reported',
    'Avvik registrert', 'Ordre ' || current_order.order_number,
    jsonb_build_object(
      'orderId', current_order.id,
      'pickJobId', current_job.id,
      'pickLineId', current_line.id,
      'exceptionId', current_exception.id,
      'eventId', event_id
    ),
    requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'exceptionId', current_exception.id,
    'pickJobId', current_job.id,
    'pickLineId', current_line.id,
    'status', current_exception.status,
    'idempotent', false
  );
end;
$$;

create or replace function public.resolve_viper_pick_exception(
  requested_exception_id uuid,
  requested_resolution_note text,
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
  current_exception public.pick_exceptions%rowtype;
  current_job public.pick_jobs%rowtype;
  current_order public.orders%rowtype;
  event_id uuid;
begin
  if requested_actor_id is null or requested_correlation_id is null then
    raise exception 'Actor and correlation ID are required';
  end if;
  if nullif(btrim(requested_resolution_note), '') is null then
    raise exception 'Resolution note is required';
  end if;

  select * into current_exception
  from public.pick_exceptions
  where id = requested_exception_id
  for update;
  if not found then raise exception 'Pick exception not found'; end if;

  if current_exception.status = 'resolved' then
    return jsonb_build_object(
      'exceptionId', current_exception.id,
      'status', current_exception.status,
      'resolvedAt', current_exception.resolved_at,
      'idempotent', true
    );
  end if;

  select * into current_job
  from public.pick_jobs
  where id = current_exception.pick_job_id
  for update;
  select * into current_order
  from public.orders
  where id = current_job.order_id;

  update public.pick_exceptions
  set status = 'resolved',
      resolved_by = requested_actor_id,
      resolved_at = now(),
      resolution_note = btrim(requested_resolution_note),
      updated_at = now()
  where id = current_exception.id
  returning * into current_exception;

  insert into public.viper_events (
    event_type, order_id, pick_job_id, pick_line_id, exception_id,
    actor_id, actor_type, correlation_id, source, payload
  ) values (
    'pick_exception_resolved', current_order.id, current_job.id,
    current_exception.pick_line_id, current_exception.id,
    requested_actor_id, 'user', requested_correlation_id, 'viper',
    jsonb_build_object('resolutionNote', current_exception.resolution_note)
  ) returning id into event_id;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'pick_line', current_exception.pick_line_id,
    'viper_pick_exception_resolved', 'Avvik løst',
    'Ordre ' || current_order.order_number,
    jsonb_build_object(
      'orderId', current_order.id,
      'pickJobId', current_job.id,
      'pickLineId', current_exception.pick_line_id,
      'exceptionId', current_exception.id,
      'eventId', event_id
    ),
    requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'exceptionId', current_exception.id,
    'status', current_exception.status,
    'resolvedAt', current_exception.resolved_at,
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
  if not found then raise exception 'Pick line not found'; end if;

  select * into current_job
  from public.pick_jobs
  where id = current_line.pick_job_id
  for update;
  current_order_id := current_job.order_id;

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
  if exists (
    select 1 from public.pick_exceptions
    where pick_line_id = current_line.id and status = 'open'
  ) then
    raise exception 'Pick line has an open exception';
  end if;

  update public.pick_lines
  set status = 'picked',
      picked_quantity = expected_quantity,
      picked_at = now(),
      picked_by = requested_actor_id,
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
  if requested_actor_id is null then raise exception 'Actor is required'; end if;

  select * into current_job
  from public.pick_jobs
  where id = requested_pick_job_id
  for update;
  if not found then raise exception 'Pick job not found'; end if;

  select * into current_order
  from public.orders
  where id = current_job.order_id
  for update;

  if current_job.status = 'completed' and current_order.status = 'picked' then
    return jsonb_build_object(
      'pickJobId', current_job.id, 'orderId', current_order.id,
      'status', current_job.status, 'completedAt', current_job.completed_at,
      'idempotent', true
    );
  end if;

  if current_job.status <> 'in_progress'
    or current_job.assigned_to <> requested_actor_id
    or current_order.status <> 'picking' then
    raise exception 'Pick job cannot be completed by actor';
  end if;
  if exists (
    select 1 from public.pick_exceptions
    where pick_job_id = current_job.id and status = 'open'
  ) then
    raise exception 'Pick job has open exceptions';
  end if;
  if exists (
    select 1 from public.pick_lines
    where pick_job_id = current_job.id
      and (status <> 'picked' or picked_by is null)
  ) then
    raise exception 'All pick lines must be completed';
  end if;
  if not exists (
    select 1 from public.pick_lines where pick_job_id = current_job.id
  ) then
    raise exception 'Pick job has no lines';
  end if;

  -- Lock and validate every inventory row before the first deduction.
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
    set quantity = quantity - line.picked_quantity, updated_at = now()
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
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = current_job.id returning * into current_job;
  update public.orders
  set status = 'picked', picked_at = current_job.completed_at, updated_at = now()
  where id = current_order.id returning * into current_order;

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
      'orderId', current_order.id, 'orderNumber', current_order.order_number,
      'pickJobId', current_job.id, 'eventId', event_id,
      'correlationId', requested_correlation_id
    ),
    requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'pickJobId', current_job.id, 'orderId', current_order.id,
    'status', current_job.status, 'completedAt', current_job.completed_at,
    'idempotent', false
  );
end;
$$;

revoke all on function public.report_viper_pick_exception(
  uuid, text, integer, text, uuid, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.resolve_viper_pick_exception(
  uuid, text, uuid, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.confirm_viper_pick_line(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_viper_pick(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.report_viper_pick_exception(
  uuid, text, integer, text, uuid, text, text, uuid
) to service_role;
grant execute on function public.resolve_viper_pick_exception(
  uuid, text, uuid, text, text, uuid
) to service_role;
grant execute on function public.confirm_viper_pick_line(uuid, uuid, uuid)
  to service_role;
grant execute on function public.complete_viper_pick(uuid, uuid, text, text, uuid)
  to service_role;
