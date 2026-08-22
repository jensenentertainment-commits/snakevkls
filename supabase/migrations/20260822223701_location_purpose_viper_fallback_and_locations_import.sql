-- Location purpose is an operational preference, not an availability switch.
-- Viper prefers PICK and falls back to BUFFER when no active PICK row can
-- satisfy the requested quantity.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.locations
  add column location_purpose text not null default 'PICK',
  add constraint locations_location_purpose_valid
    check (location_purpose in ('PICK', 'BUFFER'));

comment on column public.locations.location_purpose is
  'Preferred operational use. Viper prefers PICK and may fall back to BUFFER.';

-- BEGIN COPIED VIPER FUNCTION
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
      raise exception 'Shopify variant is not mapped in Snake: %', variant_id;
    end if;
    if not product_row.active then
      raise exception 'Shopify variant maps to an inactive Snake product: %', variant_id;
    end if;
    if line_sku is not null and product_row.sku is not null
      and lower(line_sku) <> lower(btrim(product_row.sku)) then
      raise exception 'Shopify and Snake SKU mismatch for variant: %', variant_id;
    end if;

    select
      count(*),
      count(*) filter (where inventory.location_id is not null),
      count(*) filter (where location.active),
      count(*) filter (
        where location.active and inventory.quantity >= requested_quantity
      ),
      count(*) filter (
        where location.active and inventory.quantity >= requested_quantity
          and location.location_purpose = 'PICK'
      ),
      count(*) filter (
        where location.active and inventory.quantity >= requested_quantity
          and location.location_purpose = 'BUFFER'
      ),
      count(*) filter (
        where location.active and inventory.quantity >= requested_quantity
          and location.location_purpose = 'PICK' and inventory.is_primary
      ),
      count(*) filter (
        where location.active and inventory.quantity >= requested_quantity
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
    where inventory.product_id = product_row.id;

    if inventory_count = 0 then
      raise exception 'Snake inventory is missing for variant: %', variant_id;
    end if;
    if located_inventory_count = 0 then
      raise exception 'Snake location is missing for variant: %', variant_id;
    end if;
    if active_inventory_count = 0 then
      raise exception 'Snake active location is missing for variant: %', variant_id;
    end if;
    if sufficient_inventory_count = 0 then
      raise exception 'Insufficient physical inventory for variant: %', variant_id;
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
      raise exception 'Viper pick location is ambiguous for variant: %', variant_id;
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
      and location.active
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
      raise exception 'Viper could not select inventory for variant: %', variant_id;
    end if;
    if inventory_row.zone_pick_priority is null
      or inventory_row.location_pick_sequence is null then
      raise exception 'Viper physical pick order is missing for variant: %', variant_id;
    end if;
    if exists (
      select 1 from jsonb_array_elements(prepared_lines) as prepared
      where prepared ->> 'inventoryId' = inventory_row.id::text
    ) then
      raise exception 'Multiple Shopify lines target the same Snake inventory';
    end if;

    prepared_line := jsonb_build_object(
      'externalLineId', external_line_id,
      'shopifyVariantId', variant_id,
      'sku', line_sku,
      'productName', line_product_name,
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
-- END COPIED VIPER FUNCTION

-- The import manifest is embedded in this migration so production does not
-- depend on a workstation path. Order within each zone is the physical pick
-- order supplied in Snake Lager Lokasjoner.txt.
create temporary table snake_location_import_manifest (
  code text primary key,
  zone_code text not null check (zone_code in ('HL', 'ML', 'SL')),
  pick_sequence integer not null check (pick_sequence > 0),
  unique (zone_code, pick_sequence)
) on commit drop;

-- BEGIN GENERATED LOCATION MANIFEST
with raw_codes as (
  select code, source_order
  from regexp_split_to_table($manifest$
HL01-01-A
HL01-01-B
HL01-01-C
HL01-02-A
HL01-02-B
HL01-02-C
HL01-03-A
HL01-03-B
HL01-03-C
HL02-01-A
HL02-01-B
HL02-01-C
HL02-02-A
HL02-02-B
HL02-02-C
HL02-03-A
HL02-03-B
HL02-03-C
HL03-01-A
HL03-01-B
HL03-01-C
HL03-02-A
HL03-02-B
HL03-02-C
HL03-03-A
HL03-03-B
HL03-03-C
HL04-01-A
HL04-01-B
HL04-01-C
HL04-02-A
HL04-02-B
HL04-02-C
HL04-03-A
HL04-03-B
HL04-03-C
HL05-01-A
HL05-01-B
HL05-01-C
HL05-02-A
HL05-02-B
HL05-02-C
HL05-03-A
HL05-03-B
HL05-03-C
HL06-01-A
HL06-01-B
HL06-01-C
HL06-02-A
HL06-02-B
HL06-02-C
HL06-03-A
HL06-03-B
HL06-03-C
ML01-01-A
ML01-01-B
ML01-01-C
ML01-01-D
ML01-02-A
ML01-02-B
ML01-02-C
ML01-02-D
ML01-03-A
ML01-03-B
ML01-03-C
ML01-03-D
ML01-04-A
ML01-04-B
ML01-04-C
ML01-04-D
ML02-01-A
ML02-01-B
ML02-01-C
ML02-01-D
ML02-02-A
ML02-02-B
ML02-02-C
ML02-02-D
ML02-03-A
ML02-03-B
ML02-03-C
ML02-03-D
ML02-04-A
ML02-04-B
ML02-04-C
ML02-04-D
ML03-01-A
ML03-01-B
ML03-01-C
ML03-02-A
ML03-02-B
ML03-02-C
ML03-03-A
ML03-03-B
ML03-03-C
ML03-04-A
ML03-04-B
ML03-04-C
ML03-05-A
ML03-05-B
ML03-05-C
ML04-01-A
ML04-01-B
ML04-01-C
ML04-02-A
ML04-02-B
ML04-02-C
ML04-03-A
ML04-03-B
ML04-03-C
ML04-04-A
ML04-04-B
ML04-04-C
ML04-05-A
ML04-05-B
ML04-05-C
ML05-01-A
ML05-01-B
ML05-01-C
ML05-02-A
ML05-02-B
ML05-02-C
ML05-03-A
ML05-03-B
ML05-03-C
ML05-04-A
ML05-04-B
ML05-04-C
ML05-05-A
ML05-05-B
ML05-05-C
ML06-01-A
ML06-01-B
ML06-01-C
ML06-02-A
ML06-02-B
ML06-02-C
ML06-03-A
ML06-03-B
ML06-03-C
ML06-04-A
ML06-04-B
ML06-04-C
ML06-05-A
ML06-05-B
ML06-05-C
ML07-01-A
ML07-01-B
ML07-01-C
ML07-02-A
ML07-02-B
ML07-02-C
ML07-03-A
ML07-03-B
ML07-03-C
ML07-04-A
ML07-04-B
ML07-04-C
ML07-05-A
ML07-05-B
ML07-05-C
ML08-01-A
ML09-01-A
ML09-01-B
ML09-01-C
ML09-02-A
ML09-02-B
ML09-02-C
ML09-03-A
ML09-03-B
ML09-03-C
ML09-04-A
ML09-04-B
ML09-04-C
ML09-05-A
ML09-05-B
ML09-05-C
ML10-01-A
ML10-01-B
ML10-01-C
ML10-02-A
ML10-02-B
ML10-02-C
ML10-03-A
ML10-03-B
ML10-03-C
ML10-04-A
ML10-04-B
ML10-04-C
ML11-01-A
ML12-01-A
ML12-01-B
ML12-02-A
ML12-02-B
ML12-03-A
ML12-03-B
ML12-04-A
ML12-04-B
ML13-01-A
ML13-01-B
ML13-01-C
ML13-02-A
ML13-02-B
ML13-02-C
ML13-03-A
ML13-03-B
ML13-03-C
ML13-04-A
ML13-04-B
ML13-04-C
ML14-01-A
ML14-01-B
ML14-01-C
ML14-02-A
ML14-02-B
ML14-02-C
ML14-03-A
ML14-03-B
ML14-03-C
ML14-04-A
ML14-04-B
ML14-04-C
ML14-05-A
ML14-05-B
ML14-05-C
ML15-01-A
ML15-01-B
ML15-01-C
ML15-02-A
ML15-02-B
ML15-02-C
ML15-03-A
ML15-03-B
ML15-03-C
ML15-04-A
ML15-04-B
ML15-04-C
ML15-05-A
ML15-05-B
ML15-05-C
ML16-01-A
ML16-01-B
ML16-01-C
ML16-01-D
ML16-02-A
ML16-02-B
ML16-02-C
ML16-02-D
ML16-03-A
ML16-03-B
ML16-03-C
ML16-03-D
ML16-04-A
ML16-04-B
ML16-04-C
ML16-04-D
ML17-01-A
ML17-01-B
ML17-01-C
ML17-01-D
ML17-02-A
ML17-02-B
ML17-02-C
ML17-02-D
ML17-03-A
ML17-03-B
ML17-03-C
ML17-03-D
ML17-04-A
ML17-04-B
ML17-04-C
ML17-04-D
ML18-01-A
ML18-01-B
ML18-02-A
ML18-02-B
ML18-03
ML19-01-A
ML19-01-B
ML19-02-A
ML19-02-B
ML19-03
ML20-01-A
ML20-01-B
ML20-02-A
ML20-02-B
ML20-03
ML21-01-A
ML21-01-B
ML21-02-A
ML21-02-B
ML21-03
SL01-01-A
SL01-01-B
SL01-01-C
SL01-02-A
SL01-02-B
SL01-02-C
SL01-03-A
SL01-03-B
SL01-03-C
SL01-04-A
SL01-04-B
SL01-04-C
SL01-05-A
SL01-05-B
SL01-05-C
SL01-06-A
SL01-06-B
SL01-06-C
SL02-01-A
SL02-01-B
SL02-01-C
SL02-02-A
SL02-02-B
SL02-02-C
SL02-03-A
SL02-03-B
SL02-03-C
SL02-04-A
SL02-04-B
SL02-04-C
SL02-05-A
SL02-05-B
SL02-05-C
SL02-06-A
SL02-06-B
SL02-06-C
SL02-07-A
SL02-07-B
SL02-07-C
SL03-01-A
SL03-01-B
SL03-01-C
SL03-02-A
SL03-02-B
SL03-02-C
SL03-03-A
SL03-03-B
SL03-03-C
SL03-04-A
SL03-04-B
SL03-04-C
SL03-05-A
SL03-05-B
SL03-05-C
SL04-01-A
SL04-01-B
SL04-02-A
SL04-02-B
SL04-03-A
SL04-03-B
SL04-04-A
SL04-04-B
SL04-05-A
SL04-05-B
SL05-00-A
SL05-01-A
SL05-02-A
SL05-03-A
SL06-00-A
SL06-01-A
SL07-00-A
SL07-01-A
SL08-00-A
SL08-01-A
SL09-00-A
SL09-01-A
SL10-00-A
SL10-01-A
SL11-00-A
SL11-01-A
SL12-00-A
SL12-01-A
SL13-00-A
SL13-01-A
SL14-00-A
SL14-01-A
SL15-00-A
SL15-01-A
SL16-00-A
SL16-01-A
SL17-00-A
SL17-01-A
SL18-00-A
SL18-01-A
SL18-02-A
SL18-03-A
SL19-00-A
SL19-01-A
$manifest$, E'\\s+') with ordinality as parsed(code, source_order)
  where code <> ''
), ranked_codes as (
  select
    code,
    left(code, 2) as zone_code,
    row_number() over (
      partition by left(code, 2)
      order by source_order
    )::integer as pick_sequence,
    source_order
  from raw_codes
)
insert into snake_location_import_manifest (code, zone_code, pick_sequence)
select code, zone_code, pick_sequence
from ranked_codes
order by source_order;
-- END GENERATED LOCATION MANIFEST

do $$
declare
  total_count integer;
  hl_count integer;
  ml_count integer;
  sl_count integer;
begin
  select
    count(*),
    count(*) filter (where zone_code = 'HL'),
    count(*) filter (where zone_code = 'ML'),
    count(*) filter (where zone_code = 'SL')
  into total_count, hl_count, ml_count, sl_count
  from snake_location_import_manifest;

  if total_count <> 390 or hl_count <> 54 or ml_count <> 238 or sl_count <> 98 then
    raise exception
      'Invalid warehouse location manifest: total %, HL %, ML %, SL %',
      total_count, hl_count, ml_count, sl_count;
  end if;

  if exists (
    select 1
    from snake_location_import_manifest manifest
    left join public.zones zone on zone.code = manifest.zone_code
    where zone.id is null or zone.active is not true
  ) then
    raise exception 'HL, ML and SL must exist and be active before location import';
  end if;

  if exists (
    select 1
    from snake_location_import_manifest manifest
    join public.locations location on location.code = manifest.code
    left join public.zones zone on zone.id = location.zone_id
    where zone.code is distinct from manifest.zone_code
      or location.active is not true
      or location.location_purpose is distinct from 'PICK'
      or location.pick_sequence is distinct from manifest.pick_sequence
  ) then
    raise exception 'Existing warehouse location conflicts with import manifest';
  end if;
end;
$$;

insert into public.locations (
  code,
  active,
  zone_id,
  pick_sequence,
  location_purpose
)
select
  manifest.code,
  true,
  zone.id,
  manifest.pick_sequence,
  'PICK'
from snake_location_import_manifest manifest
join public.zones zone on zone.code = manifest.zone_code
where not exists (
  select 1 from public.locations location where location.code = manifest.code
)
order by zone.pick_priority, manifest.pick_sequence;

do $$
begin
  if (
    select count(*)
    from snake_location_import_manifest manifest
    join public.locations location on location.code = manifest.code
    join public.zones zone on zone.id = location.zone_id
    where location.active
      and location.location_purpose = 'PICK'
      and zone.code = manifest.zone_code
      and location.pick_sequence = manifest.pick_sequence
  ) <> 390 then
    raise exception 'Warehouse location import verification failed';
  end if;
end;
$$;


