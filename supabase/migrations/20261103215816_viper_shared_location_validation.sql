-- Viper V1: one database-owned location selection contract. No data changes.
create or replace function public.validate_viper_order_lines(requested_lines jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  product_row public.products%rowtype;
  inventory_row record;
  input_line jsonb;
  prepared_line jsonb;
  prepared_lines jsonb := '[]'::jsonb;
  external_line_id text;
  variant_id text;
  line_sku text;
  line_product_name text;
  line_variant_name text;
  requested_quantity integer;
  sequence_number integer;
  physical_sequence_number integer := 0;
  inventory_count integer;
  located_inventory_count integer;
  active_inventory_count integer;
  sufficient_inventory_count integer;
  sufficient_pick_count integer;
  sufficient_buffer_count integer;
  sufficient_pick_primary_count integer;
  sufficient_buffer_primary_count integer;
  sufficient_candidate_count integer;
  sufficient_primary_count integer;
  candidate_location_purpose text;

begin
 if jsonb_typeof(requested_lines) is distinct from 'array' or jsonb_array_length(requested_lines) not between 1 and 100 then raise exception 'Invalid Viper lines'; end if;
  -- Resolve and validate every line before the first persistent write.
  for input_line in
    select value from jsonb_array_elements(requested_lines)
  loop
    external_line_id := nullif(btrim(input_line ->> 'externalLineId'), '');
    variant_id := nullif(btrim(input_line ->> 'shopifyVariantId'), '');
    line_sku := nullif(btrim(input_line ->> 'sku'), '');
    line_product_name := nullif(btrim(input_line ->> 'productName'), '');
    line_variant_name := nullif(btrim(input_line ->> 'variantName'), '');

    begin
      requested_quantity := (input_line ->> 'requestedQuantity')::integer;
      sequence_number := (input_line ->> 'sequenceNumber')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Viper Shopify line has invalid quantity or sequence';
    end;

    if external_line_id is null or variant_id is null
      or line_product_name is null
      or requested_quantity is null or requested_quantity <= 0
      or sequence_number is null or sequence_number <= 0 then
      raise exception 'Viper Shopify line is incomplete';
    end if;
    if exists (
      select 1 from jsonb_array_elements(prepared_lines) as prepared
      where prepared ->> 'externalLineId' = external_line_id
    ) then
      raise exception 'Duplicate Shopify order line ID';
    end if;
    if exists (
      select 1 from jsonb_array_elements(prepared_lines) as prepared
      where (prepared ->> 'sequenceNumber')::integer = sequence_number
    ) then
      raise exception 'Duplicate Viper line sequence';
    end if;

    select * into product_row
    from public.products
    where shopify_variant_id = variant_id;
    if not found then
      raise exception using errcode='P0001', message='PRODUCT_NOT_FOUND', detail=external_line_id;
    end if;
    if not product_row.active then
      raise exception using errcode='P0001', message='PRODUCT_INACTIVE', detail=external_line_id;
    end if;
    if line_sku is not null and product_row.sku is not null
      and lower(line_sku) <> lower(btrim(product_row.sku)) then
      raise exception using errcode='P0001', message='SKU_MISMATCH', detail=external_line_id;
    end if;

    select
      count(*),
      count(*) filter (where inventory.location_id is not null),
      count(*) filter (where location.active and zone.active),
      count(*) filter (
        where location.active and zone.active and inventory.quantity >= requested_quantity
      ),
      count(*) filter (
        where location.active and zone.active and inventory.quantity >= requested_quantity
          and location.location_purpose = 'PICK'
      ),
      count(*) filter (
        where location.active and zone.active and inventory.quantity >= requested_quantity
          and location.location_purpose = 'BUFFER'
      ),
      count(*) filter (
        where location.active and zone.active and inventory.quantity >= requested_quantity
          and location.location_purpose = 'PICK' and inventory.is_primary
      ),
      count(*) filter (
        where location.active and zone.active and inventory.quantity >= requested_quantity
          and location.location_purpose = 'BUFFER' and inventory.is_primary
      )
    into
      inventory_count,
      located_inventory_count,
      active_inventory_count,
      sufficient_inventory_count,
      sufficient_pick_count,
      sufficient_buffer_count,
      sufficient_pick_primary_count,
      sufficient_buffer_primary_count
    from public.inventory as inventory
    left join public.locations as location on location.id = inventory.location_id
    left join public.zones as zone on zone.id = location.zone_id
    where inventory.product_id = product_row.id;

    if inventory_count = 0 then
      raise exception using errcode='P0001', message='INVENTORY_MISSING', detail=external_line_id;
    end if;
    if located_inventory_count = 0 then
      raise exception using errcode='P0001', message='LOCATION_MISSING', detail=external_line_id;
    end if;
    if active_inventory_count = 0 then
      raise exception using errcode='P0001', message='LOCATION_INACTIVE', detail=external_line_id;
    end if;
    if sufficient_inventory_count = 0 then
      raise exception using errcode='P0001', message='INSUFFICIENT_PHYSICAL_STOCK', detail=external_line_id;
    end if;

    -- PICK is preferred whenever at least one active PICK location can satisfy
    -- the line. BUFFER remains available as a fallback candidate pool.
    if sufficient_pick_count > 0 then
      candidate_location_purpose := 'PICK';
      sufficient_candidate_count := sufficient_pick_count;
      sufficient_primary_count := sufficient_pick_primary_count;
    else
      candidate_location_purpose := 'BUFFER';
      sufficient_candidate_count := sufficient_buffer_count;
      sufficient_primary_count := sufficient_buffer_primary_count;
    end if;

    if sufficient_primary_count > 1
      or (sufficient_primary_count = 0 and sufficient_candidate_count > 1) then
      raise exception using errcode='P0001', message='PICK_LOCATION_AMBIGUOUS', detail=external_line_id;
    end if;

    select
      inventory.id,
      inventory.location_id,
      inventory.quantity,
      location.code,
      zone.pick_priority as zone_pick_priority,
      location.pick_sequence as location_pick_sequence
    into inventory_row
    from public.inventory as inventory
    join public.locations as location on location.id = inventory.location_id
    join public.zones as zone on zone.id = location.zone_id
    where inventory.product_id = product_row.id
      and location.active and zone.active
      and location.location_purpose = candidate_location_purpose
      and inventory.quantity >= requested_quantity
      and (
        (sufficient_primary_count = 1 and inventory.is_primary)
        or
        (sufficient_primary_count = 0 and sufficient_candidate_count = 1)
      )
    order by inventory.id
    limit 1;

    if inventory_row.id is null then
      raise exception using errcode='P0001', message='LOCATION_MISSING', detail=external_line_id;
    end if;
    if inventory_row.zone_pick_priority is null
      or inventory_row.location_pick_sequence is null then
      raise exception using errcode='P0001', message='PICK_ORDER_MISSING', detail=external_line_id;
    end if;
    if exists (
      select 1 from jsonb_array_elements(prepared_lines) as prepared
      where prepared ->> 'inventoryId' = inventory_row.id::text
    ) then
      raise exception using errcode='P0001', message='DUPLICATE_PICK_TARGET', detail=external_line_id;
    end if;

    prepared_line := jsonb_build_object(
      'externalLineId', external_line_id,
      'shopifyVariantId', variant_id,
      'sku', line_sku,
      'productName', line_product_name,
      'snakeProductName', product_row.product_name,
      'snakeSku', product_row.sku,
      'variantName', line_variant_name,
      'requestedQuantity', requested_quantity,
      'sequenceNumber', sequence_number,
      'productId', product_row.id,
      'inventoryId', inventory_row.id,
      'locationId', inventory_row.location_id,
      'locationCode', inventory_row.code,
      'locationPurpose', candidate_location_purpose,
      'zonePickPriority', inventory_row.zone_pick_priority,
      'locationPickSequence', inventory_row.location_pick_sequence,
      'availableQuantity', inventory_row.quantity
    );
    prepared_lines := prepared_lines || jsonb_build_array(prepared_line);
  end loop;


 return (select jsonb_agg(value order by
   (value->>'zonePickPriority')::integer, (value->>'locationPickSequence')::integer,
   value->>'locationId', value->>'externalLineId') from jsonb_array_elements(prepared_lines));
end;
$$;
revoke all on function public.validate_viper_order_lines(jsonb) from public, anon, authenticated;
grant execute on function public.validate_viper_order_lines(jsonb) to service_role;

create or replace function public.materialize_viper_shopify_order(
  requested_external_order_id text,
  requested_order_number text,
  requested_external_updated_at timestamptz,
  requested_received_at timestamptz,
  requested_lines jsonb,
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
  existing_order public.orders%rowtype;
  existing_job public.pick_jobs%rowtype;
  created_order public.orders%rowtype;
  created_job public.pick_jobs%rowtype;
  created_order_line public.order_lines%rowtype;
  product_row public.products%rowtype;
  inventory_row record;
  input_line jsonb;
  prepared_line jsonb;
  prepared_lines jsonb := '[]'::jsonb;
  external_line_id text;
  variant_id text;
  line_sku text;
  line_product_name text;
  line_variant_name text;
  requested_quantity integer;
  sequence_number integer;
  physical_sequence_number integer := 0;
  inventory_count integer;
  located_inventory_count integer;
  active_inventory_count integer;
  sufficient_inventory_count integer;
  sufficient_pick_count integer;
  sufficient_buffer_count integer;
  sufficient_pick_primary_count integer;
  sufficient_buffer_primary_count integer;
  sufficient_candidate_count integer;
  sufficient_primary_count integer;
  candidate_location_purpose text;
  order_event_id uuid;
  job_event_id uuid;
begin
  if nullif(btrim(requested_external_order_id), '') is null
    or nullif(btrim(requested_order_number), '') is null
    or requested_external_updated_at is null
    or requested_received_at is null
    or requested_actor_id is null
    or requested_correlation_id is null then
    raise exception 'Viper Shopify import requires order, timestamps, actor and correlation ID';
  end if;

  if jsonb_typeof(requested_lines) <> 'array'
    or jsonb_array_length(requested_lines) = 0 then
    raise exception 'Viper Shopify import requires at least one line';
  end if;
  if jsonb_array_length(requested_lines) > 100 then
    raise exception 'Viper Shopify import supports at most 100 lines';
  end if;

  -- Serialize imports for one Shopify order before checking idempotency.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'viper:shopify-order:' || btrim(requested_external_order_id),
      0
    )
  );

  select * into existing_order
  from public.orders
  where source = 'shopify'
    and external_order_id = btrim(requested_external_order_id);

  if found then
    if existing_order.external_updated_at is distinct from requested_external_updated_at then
      raise exception 'Viper Shopify order already imported with a different updatedAt';
    end if;

    select * into existing_job
    from public.pick_jobs
    where order_id = existing_order.id;
    if not found then
      raise exception 'Existing Viper Shopify order is missing its pick job';
    end if;

    return jsonb_build_object(
      'orderId', existing_order.id,
      'pickJobId', existing_job.id,
      'orderNumber', existing_order.order_number,
      'orderStatus', existing_order.status,
      'pickJobStatus', existing_job.status,
      'lineCount', (
        select count(*) from public.order_lines
        where order_id = existing_order.id
      ),
      'idempotent', true
    );
  end if;

  prepared_lines := public.validate_viper_order_lines(requested_lines);

  insert into public.orders (
    source, external_order_id, order_number, status,
    external_updated_at, received_at, ready_at
  ) values (
    'shopify', btrim(requested_external_order_id), btrim(requested_order_number),
    'ready_to_pick', requested_external_updated_at, requested_received_at, now()
  ) returning * into created_order;

  for prepared_line in
    select value
    from jsonb_array_elements(prepared_lines)
    order by
      (value ->> 'zonePickPriority')::integer,
      (value ->> 'locationPickSequence')::integer,
      value ->> 'locationId',
      value ->> 'externalLineId'
  loop
    physical_sequence_number := physical_sequence_number + 1;

    insert into public.order_lines (
      order_id, external_line_id, product_id, shopify_variant_id, sku,
      product_name, variant_name, requested_quantity
    ) values (
      created_order.id,
      prepared_line ->> 'externalLineId',
      (prepared_line ->> 'productId')::uuid,
      prepared_line ->> 'shopifyVariantId',
      prepared_line ->> 'sku',
      prepared_line ->> 'productName',
      prepared_line ->> 'variantName',
      (prepared_line ->> 'requestedQuantity')::integer
    ) returning * into created_order_line;

    -- The pick job is created once, before its first line.
    if created_job.id is null then
      insert into public.pick_jobs (order_id, status)
      values (created_order.id, 'ready')
      returning * into created_job;
    end if;

    insert into public.pick_lines (
      pick_job_id, order_line_id, product_id, inventory_id, location_id,
      expected_quantity, sequence_number
    ) values (
      created_job.id,
      created_order_line.id,
      (prepared_line ->> 'productId')::uuid,
      (prepared_line ->> 'inventoryId')::uuid,
      (prepared_line ->> 'locationId')::uuid,
      (prepared_line ->> 'requestedQuantity')::integer,
      physical_sequence_number
    );
  end loop;

  insert into public.viper_events (
    event_type, order_id, actor_id, actor_type, correlation_id, source,
    idempotency_key, payload
  ) values (
    'order_imported', created_order.id, requested_actor_id, 'user',
    requested_correlation_id, 'shopify',
    'order-imported:' || btrim(requested_external_order_id),
    jsonb_build_object(
      'externalOrderId', created_order.external_order_id,
      'orderNumber', created_order.order_number,
      'externalUpdatedAt', created_order.external_updated_at,
      'lineCount', jsonb_array_length(prepared_lines)
    )
  ) returning id into order_event_id;

  insert into public.viper_events (
    event_type, order_id, pick_job_id, actor_id, actor_type,
    correlation_id, causation_id, source, idempotency_key, payload
  ) values (
    'pick_job_created', created_order.id, created_job.id,
    requested_actor_id, 'user', requested_correlation_id, order_event_id,
    'viper', 'pick-job-created:' || btrim(requested_external_order_id),
    jsonb_build_object(
      'externalOrderId', created_order.external_order_id,
      'orderNumber', created_order.order_number,
      'pickJobId', created_job.id,
      'lineCount', jsonb_array_length(prepared_lines)
    )
  ) returning id into job_event_id;

  insert into public.activity_log (
    entity_type, entity_id, action, title, description, metadata,
    actor_id, actor_email, actor_name
  ) values (
    'order', created_order.id, 'viper_order_imported',
    'Shopify-ordre klar til plukk',
    'Ordre ' || created_order.order_number,
    jsonb_build_object(
      'orderId', created_order.id,
      'externalOrderId', created_order.external_order_id,
      'orderNumber', created_order.order_number,
      'pickJobId', created_job.id,
      'orderEventId', order_event_id,
      'pickJobEventId', job_event_id,
      'correlationId', requested_correlation_id,
      'lineCount', jsonb_array_length(prepared_lines)
    ),
    requested_actor_id, requested_actor_email, requested_actor_name
  );

  return jsonb_build_object(
    'orderId', created_order.id,
    'pickJobId', created_job.id,
    'orderNumber', created_order.order_number,
    'orderStatus', created_order.status,
    'pickJobStatus', created_job.status,
    'lineCount', jsonb_array_length(prepared_lines),
    'idempotent', false
  );
end;
$$;

revoke all on function public.materialize_viper_shopify_order(
  text, text, timestamptz, timestamptz, jsonb, uuid, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.materialize_viper_shopify_order(
  text, text, timestamptz, timestamptz, jsonb, uuid, text, text, uuid
) to service_role;
