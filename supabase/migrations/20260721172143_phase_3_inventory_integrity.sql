-- Phase 3: atomic inventory operations and consistent audit records.

alter table public.stock_movements
  drop constraint if exists stock_movements_reason_valid;

alter table public.activity_log
  drop constraint if exists activity_log_entity_type_check;

alter table public.activity_log
  add constraint activity_log_entity_type_check check (
    entity_type = any (array[
      'product', 'inventory', 'location', 'zone', 'stock_movement',
      'shopify_sync', 'system', 'user'
    ])
  );

create or replace function public.apply_stock_movement(
  requested_inventory_id uuid,
  requested_quantity_delta integer,
  requested_reason text,
  requested_note text default null,
  expected_quantity integer default null,
  requested_actor_id uuid default null,
  requested_actor_email text default null,
  requested_actor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_inventory public.inventory%rowtype;
  product_name text;
  location_code text;
  next_quantity integer;
  effective_quantity_delta integer;
  movement_id uuid;
begin
  if requested_quantity_delta = 0 then
    raise exception 'Quantity delta must not be zero';
  end if;

  select * into current_inventory
  from public.inventory
  where id = requested_inventory_id
  for update;

  if not found then
    raise exception 'Inventory row not found';
  end if;

  select product.product_name into product_name
  from public.products as product
  where product.id = current_inventory.product_id;
  select location.code into location_code
  from public.locations as location
  where location.id = current_inventory.location_id;

  if expected_quantity is not null
    and current_inventory.quantity <> expected_quantity then
    raise exception 'Inventory quantity changed concurrently';
  end if;

  effective_quantity_delta := case
    when requested_quantity_delta < 0 then
      greatest(requested_quantity_delta, -current_inventory.quantity)
    else requested_quantity_delta
  end;
  if effective_quantity_delta = 0 then
    raise exception 'Insufficient inventory';
  end if;
  next_quantity := current_inventory.quantity + effective_quantity_delta;

  update public.inventory
  set quantity = next_quantity,
      updated_at = now()
  where id = current_inventory.id;

  insert into public.stock_movements (
    product_id, inventory_id, quantity_delta, reason, note
  ) values (
    current_inventory.product_id, current_inventory.id,
    effective_quantity_delta, requested_reason, nullif(btrim(requested_note), '')
  ) returning id into movement_id;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'stock_movement', movement_id, 'manual_stock_movement',
    'Lagerhendelse registrert',
    product_name || ' (' || effective_quantity_delta::text || ')',
    jsonb_build_object(
      'productId', current_inventory.product_id,
      'inventoryId', current_inventory.id,
      'locationId', current_inventory.location_id,
      'locationCode', location_code,
      'previousQuantity', current_inventory.quantity,
      'nextQuantity', next_quantity,
      'quantityDelta', effective_quantity_delta,
      'reason', requested_reason,
      'note', nullif(btrim(requested_note), '')
    ),
    requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'inventoryId', current_inventory.id,
    'movementId', movement_id,
    'previousQuantity', current_inventory.quantity,
    'quantityDelta', effective_quantity_delta,
    'nextQuantity', next_quantity
  );
end;
$$;

create or replace function public.set_product_location(
  requested_product_id uuid,
  requested_inventory_id uuid,
  requested_zone_id uuid,
  requested_location_id uuid,
  requested_quantity integer,
  requested_actor_id uuid default null,
  requested_actor_email text default null,
  requested_actor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_inventory public.inventory%rowtype;
  saved_inventory public.inventory%rowtype;
  effective_zone_id uuid := requested_zone_id;
  product_name text;
  previous_quantity integer := 0;
  previous_zone_code text;
  previous_location_code text;
  zone_code text;
  location_code text;
  movement_id uuid;
  quantity_delta integer;
begin
  if requested_quantity < 0 then
    raise exception 'Quantity must not be negative';
  end if;

  select product.product_name into product_name
  from public.products as product where product.id = requested_product_id
  for update;
  if not found then raise exception 'Product not found'; end if;

  if requested_location_id is not null then
    select location.zone_id, location.code
    into effective_zone_id, location_code
    from public.locations as location
    where location.id = requested_location_id and location.active = true;
    if not found then raise exception 'Location not found or inactive'; end if;
  end if;

  if effective_zone_id is null then
    raise exception 'Zone or location is required';
  end if;

  select zone.code into zone_code from public.zones as zone
  where zone.id = effective_zone_id;
  if not found then raise exception 'Zone not found'; end if;

  if requested_inventory_id is not null then
    select * into current_inventory from public.inventory
    where id = requested_inventory_id for update;
    if not found or current_inventory.product_id <> requested_product_id then
      raise exception 'Inventory row does not belong to product';
    end if;

    previous_quantity := current_inventory.quantity;
    select code into previous_zone_code from public.zones
      where id = current_inventory.zone_id;
    select code into previous_location_code from public.locations
      where id = current_inventory.location_id;

    update public.inventory
    set zone_id = effective_zone_id,
        location_id = requested_location_id,
        quantity = requested_quantity,
        updated_at = now()
    where id = current_inventory.id
    returning * into saved_inventory;
  else
    insert into public.inventory (
      product_id, zone_id, location_id, quantity, is_primary
    ) values (
      requested_product_id, effective_zone_id, requested_location_id,
      requested_quantity,
      not exists (select 1 from public.inventory where product_id = requested_product_id and is_primary)
    ) returning * into saved_inventory;
  end if;

  quantity_delta := requested_quantity - previous_quantity;
  if quantity_delta <> 0 then
    insert into public.stock_movements (
      product_id, inventory_id, quantity_delta, reason, note
    ) values (
      requested_product_id, saved_inventory.id, quantity_delta, 'correction',
      'Antall endret ved plassering'
    ) returning id into movement_id;
  end if;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'inventory', saved_inventory.id,
    case when requested_location_id is null then 'zone_set' else 'location_set' end,
    case when requested_location_id is null then 'Sone satt' else 'Lokasjon satt' end,
    product_name || ' → ' || coalesce(location_code, zone_code),
    jsonb_build_object(
      'productId', requested_product_id,
      'inventoryId', saved_inventory.id,
      'movementId', movement_id,
      'fromZone', previous_zone_code,
      'toZone', zone_code,
      'fromLocation', previous_location_code,
      'toLocation', location_code,
      'previousQuantity', previous_quantity,
      'newQuantity', requested_quantity,
      'locationId', requested_location_id,
      'zoneId', effective_zone_id,
      'source', 'manual'
    ), requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'inventoryId', saved_inventory.id,
    'movementId', movement_id,
    'previousQuantity', previous_quantity,
    'newQuantity', requested_quantity
  );
end;
$$;

create or replace function public.add_product_to_location(
  requested_product_id uuid,
  requested_location_id uuid,
  requested_quantity integer,
  requested_actor_id uuid default null,
  requested_actor_email text default null,
  requested_actor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  location_row public.locations%rowtype;
  product_name text;
  saved_inventory public.inventory%rowtype;
  previous_quantity integer;
  movement_id uuid;
begin
  if requested_quantity < 0 then raise exception 'Quantity must not be negative'; end if;

  select * into location_row from public.locations
  where id = requested_location_id and active = true;
  if not found then raise exception 'Location not found or inactive'; end if;

  select product.product_name into product_name from public.products as product
  where product.id = requested_product_id;
  if not found then raise exception 'Product not found'; end if;

  insert into public.inventory (
    product_id, location_id, zone_id, quantity, is_primary
  ) values (
    requested_product_id, requested_location_id, location_row.zone_id,
    requested_quantity, false
  )
  on conflict (product_id, location_id) do update
  set quantity = public.inventory.quantity + excluded.quantity,
      zone_id = excluded.zone_id,
      updated_at = now()
  returning * into saved_inventory;

  previous_quantity := saved_inventory.quantity - requested_quantity;

  if requested_quantity <> 0 then
    insert into public.stock_movements (
      product_id, inventory_id, quantity_delta, reason, note
    ) values (
      requested_product_id, saved_inventory.id, requested_quantity,
      'receiving', 'Produkt lagt til lokasjon'
    ) returning id into movement_id;
  end if;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'location', requested_location_id, 'product_added_to_location',
    'Produkt lagt til lokasjon', product_name || ' → ' || location_row.code,
    jsonb_build_object(
      'product_id', requested_product_id,
      'inventory_id', saved_inventory.id,
      'movement_id', movement_id,
      'location_id', requested_location_id,
      'location_code', location_row.code,
      'previous_quantity', previous_quantity,
      'new_quantity', saved_inventory.quantity,
      'added_quantity', requested_quantity,
      'source', 'location_page',
      'user_id', requested_actor_id
    ), requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'productId', requested_product_id,
    'inventoryId', saved_inventory.id,
    'movementId', movement_id,
    'previousQuantity', previous_quantity,
    'newQuantity', saved_inventory.quantity
  );
end;
$$;

create or replace function public.remove_product_from_location(
  requested_inventory_id uuid,
  requested_actor_id uuid default null,
  requested_actor_email text default null,
  requested_actor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_inventory public.inventory%rowtype;
  product_name text;
  location_code text;
  movement_id uuid;
begin
  select * into current_inventory
  from public.inventory
  where id = requested_inventory_id
  for update;
  if not found then raise exception 'Inventory row not found'; end if;

  select product.product_name into product_name
  from public.products as product
  where product.id = current_inventory.product_id;
  select location.code into location_code
  from public.locations as location
  where location.id = current_inventory.location_id;

  if current_inventory.quantity <> 0 then
    insert into public.stock_movements (
      product_id, inventory_id, quantity_delta, reason, note
    ) values (
      current_inventory.product_id, current_inventory.id,
      -current_inventory.quantity, 'correction', 'Produkt fjernet fra lokasjon'
    ) returning id into movement_id;
  end if;

  delete from public.inventory where id = current_inventory.id;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'inventory', current_inventory.id, 'removed_from_location',
    'Produkt fjernet fra lokasjon',
    product_name || ' fjernet fra ' || coalesce(location_code, 'ukjent lokasjon'),
    jsonb_build_object(
      'product_id', current_inventory.product_id,
      'inventory_id', current_inventory.id,
      'movement_id', movement_id,
      'location_id', current_inventory.location_id,
      'location_code', location_code,
      'from_location', location_code,
      'to_location', null,
      'previous_quantity', current_inventory.quantity,
      'new_quantity', 0,
      'removed_quantity', current_inventory.quantity,
      'source', 'location_page',
      'user_id', requested_actor_id
    ), requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'inventoryId', current_inventory.id,
    'movementId', movement_id,
    'previousQuantity', current_inventory.quantity,
    'newQuantity', 0
  );
end;
$$;

create or replace function public.batch_set_product_zone(
  requested_product_ids uuid[],
  requested_zone_id uuid,
  requested_actor_id uuid default null,
  requested_actor_email text default null,
  requested_actor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_row record;
  inventory_row public.inventory%rowtype;
  movement_id uuid;
  updated_count integer := 0;
begin
  if coalesce(array_length(requested_product_ids, 1), 0) = 0 then
    raise exception 'At least one product is required';
  end if;
  if not exists (select 1 from public.zones where id = requested_zone_id) then
    raise exception 'Zone not found';
  end if;

  for product_row in
    select product.id, product.shopify_quantity
    from public.products as product
    where product.id = any(requested_product_ids)
    order by product.id
    for update of product
  loop
    select * into inventory_row from public.inventory
    where product_id = product_row.id
    order by is_primary desc, created_at, id
    limit 1 for update;

    if found then
      update public.inventory set zone_id = requested_zone_id, updated_at = now()
      where id = inventory_row.id;
    else
      insert into public.inventory (product_id, zone_id, quantity, is_primary)
      values (product_row.id, requested_zone_id, coalesce(product_row.shopify_quantity, 0), true)
      returning * into inventory_row;

      if inventory_row.quantity <> 0 then
        insert into public.stock_movements (
          product_id, inventory_id, quantity_delta, reason, note
        ) values (
          product_row.id, inventory_row.id, inventory_row.quantity,
          'correction', 'Lagerlinje opprettet ved batch-plassering'
        ) returning id into movement_id;
      end if;
    end if;
    updated_count := updated_count + 1;
  end loop;

  if updated_count <> cardinality(requested_product_ids) then
    raise exception 'One or more products were not found';
  end if;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'inventory', null, 'batch_zone_set', 'Batch sone satt',
    updated_count::text || ' produkter oppdatert',
    jsonb_build_object(
      'zoneId', requested_zone_id,
      'productIds', to_jsonb(requested_product_ids),
      'updated', updated_count
    ), requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object('updated', updated_count);
end;
$$;

create or replace function public.record_location_count(
  requested_location_id uuid,
  requested_inventory_id uuid,
  requested_expected_quantity integer,
  requested_counted_quantity integer,
  requested_note text default null,
  requested_actor_id uuid default null,
  requested_actor_email text default null,
  requested_actor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_inventory public.inventory%rowtype;
  count_row public.location_counts%rowtype;
begin
  if requested_expected_quantity < 0 or requested_counted_quantity < 0 then
    raise exception 'Count quantities must not be negative';
  end if;

  select * into current_inventory from public.inventory
  where id = requested_inventory_id for update;
  if not found or current_inventory.location_id is distinct from requested_location_id then
    raise exception 'Inventory row does not belong to location';
  end if;
  if current_inventory.quantity <> requested_expected_quantity then
    raise exception 'Inventory quantity changed before count was saved';
  end if;

  insert into public.location_counts (
    location_id, inventory_id, expected_quantity, counted_quantity,
    note, counted_by, counted_by_name
  ) values (
    requested_location_id, requested_inventory_id,
    requested_expected_quantity, requested_counted_quantity,
    nullif(btrim(requested_note), ''), requested_actor_id, requested_actor_name
  ) returning * into count_row;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'location', requested_location_id, 'location_count', 'Lokasjon telt',
    'Forventet ' || requested_expected_quantity::text || ', telte ' || requested_counted_quantity::text || '.',
    jsonb_build_object(
      'locationId', requested_location_id,
      'inventoryId', requested_inventory_id,
      'expectedQuantity', requested_expected_quantity,
      'countedQuantity', requested_counted_quantity,
      'difference', count_row.difference,
      'note', nullif(btrim(requested_note), ''),
      'countId', count_row.id
    ), requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'id', count_row.id,
    'locationId', count_row.location_id,
    'inventoryId', count_row.inventory_id,
    'expectedQuantity', count_row.expected_quantity,
    'countedQuantity', count_row.counted_quantity,
    'difference', count_row.difference,
    'countedAt', count_row.counted_at
  );
end;
$$;

revoke all on function public.apply_stock_movement(uuid, integer, text, text, integer, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.set_product_location(uuid, uuid, uuid, uuid, integer, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.add_product_to_location(uuid, uuid, integer, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.remove_product_from_location(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.batch_set_product_zone(uuid[], uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.record_location_count(uuid, uuid, integer, integer, text, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.apply_stock_movement(uuid, integer, text, text, integer, uuid, text, text)
  to service_role;
grant execute on function public.set_product_location(uuid, uuid, uuid, uuid, integer, uuid, text, text)
  to service_role;
grant execute on function public.add_product_to_location(uuid, uuid, integer, uuid, text, text)
  to service_role;
grant execute on function public.remove_product_from_location(uuid, uuid, text, text)
  to service_role;
grant execute on function public.batch_set_product_zone(uuid[], uuid, uuid, text, text)
  to service_role;
grant execute on function public.record_location_count(uuid, uuid, integer, integer, text, uuid, text, text)
  to service_role;
