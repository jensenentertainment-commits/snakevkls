-- Requires the three existing Viper migrations and SKU-independent catalog identity.
-- Only cross-catalog SKU equality is removed. Imported source snapshots, versions,
-- commands, role checks, stock checks and lock order are preserved.
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
    -- SKU is descriptive; the exact Shopify variant resolved above is identity.

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

create or replace function public.apply_viper_pick_command(
 requested_pick_job_id uuid,requested_expected_version integer,requested_command_id uuid,
 requested_action text,requested_payload jsonb,requested_actor_id uuid,requested_source jsonb default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 job public.pick_jobs%rowtype; ord public.orders%rowtype; recovered jsonb;
 observed_at timestamptz; observed_update timestamptz; actual_lines jsonb; supplied_lines jsonb;
 line record; result jsonb;
begin
 if requested_action not in ('start','complete') then
   return private.apply_viper_pick_command(requested_pick_job_id,requested_expected_version,requested_command_id,requested_action,requested_payload,requested_actor_id);
 end if;
 if requested_action='start' then perform pg_advisory_xact_lock(hashtextextended('viper_pilot_active_pick',0)); end if;
 select * into job from public.pick_jobs where id=requested_pick_job_id for update;
 if not found then raise exception 'VIPER_NOT_FOUND'; end if;
 recovered:=public.get_viper_pick_command_result(job.id,requested_expected_version,requested_command_id,requested_action,requested_payload,requested_actor_id);
 if recovered is not null then return recovered; end if;
 if job.version is distinct from requested_expected_version then raise exception 'VIPER_STALE_VERSION'; end if;
 if requested_action='complete' and job.assigned_to is distinct from requested_actor_id then raise exception 'VIPER_FORBIDDEN'; end if;
 select * into ord from public.orders where id=job.order_id for update;
 perform 1 from public.pick_lines where pick_job_id=job.id order by id for update;
 -- Imported source lines also remain stable until commit (non-key edits do not lock the parent order).
 perform 1 from public.order_lines where order_id=ord.id order by id for share;
 perform 1 from public.pick_exceptions where pick_job_id=job.id order by id for update;
 if ord.source='shopify' then
   if requested_source is null or jsonb_typeof(requested_source) <> 'object'
     or requested_source->>'externalOrderId' is distinct from ord.external_order_id
     or jsonb_typeof(requested_source->'lines') is distinct from 'array'
     then raise exception 'VIPER_SOURCE_REQUIRED'; end if;
   observed_at:=(requested_source->>'observedAt')::timestamptz;
   observed_update:=(requested_source->>'externalUpdatedAt')::timestamptz;
   if observed_at is null or observed_at < clock_timestamp()-interval '30 seconds'
     or observed_at > clock_timestamp()+interval '5 seconds' then raise exception 'VIPER_SOURCE_EXPIRED'; end if;
   if observed_update is null or observed_update is distinct from ord.external_updated_at then raise exception 'VIPER_SOURCE_CHANGED'; end if;
   select jsonb_agg(jsonb_build_object('externalLineId',external_line_id,'shopifyVariantId',shopify_variant_id,'sku',sku,'requestedQuantity',requested_quantity) order by external_line_id)
     into actual_lines from public.order_lines where order_id=ord.id;
   select jsonb_agg(value order by value->>'externalLineId') into supplied_lines from jsonb_array_elements(requested_source->'lines');
   if actual_lines is null or actual_lines is distinct from supplied_lines then raise exception 'VIPER_SOURCE_CHANGED'; end if;
 end if;
 -- Product before inventory matches existing warehouse upsert/batch-zone order.
 -- SHARE protects active flags/identity without upgrading warehouse row locks.
 perform 1 from public.products where id in(select product_id from public.pick_lines where pick_job_id=job.id) order by id for share;
 perform 1 from public.locations where id in(select location_id from public.pick_lines where pick_job_id=job.id) order by id for share;
 perform 1 from public.zones where id in(select zone_id from public.locations where id in(select location_id from public.pick_lines where pick_job_id=job.id)) order by id for share;
 perform 1 from public.inventory where id in(select inventory_id from public.pick_lines where pick_job_id=job.id) order by id for update;
 if not exists(select 1 from public.pick_lines where pick_job_id=job.id) then raise exception 'VIPER_STOCK_CHANGED'; end if;
 for line in
   select pl.*,i.id as current_inventory_id,i.quantity,i.product_id as current_product,i.location_id as current_location,i.zone_id as inventory_zone,
     p.active as product_active,p.shopify_variant_id as current_variant,p.sku as current_sku,
     loc.active as location_active,loc.zone_id,loc.pick_sequence,z.active as zone_active,z.pick_priority,
     ol.shopify_variant_id,ol.sku,ol.requested_quantity,ol.order_id as line_order,
     row_number() over(order by z.pick_priority,loc.pick_sequence,loc.id,ol.external_line_id) as physical_sequence
   from public.pick_lines pl left join public.inventory i on i.id=pl.inventory_id
   left join public.products p on p.id=pl.product_id left join public.locations loc on loc.id=pl.location_id
   left join public.zones z on z.id=loc.zone_id left join public.order_lines ol on ol.id=pl.order_line_id
   where pl.pick_job_id=job.id
 loop
   if line.current_inventory_id is null or line.current_product is distinct from line.product_id
     or line.current_location is distinct from line.location_id or line.inventory_zone is distinct from line.zone_id
     or line.quantity < line.expected_quantity or line.requested_quantity is distinct from line.expected_quantity
     or line.line_order is distinct from ord.id then raise exception 'VIPER_STOCK_CHANGED'; end if;
   if line.product_active is distinct from true or line.location_active is distinct from true or line.zone_active is distinct from true
     or line.pick_sequence is null or line.pick_priority is null or line.sequence_number <> line.physical_sequence
     or (ord.source='shopify' and line.current_variant is distinct from line.shopify_variant_id)
     then raise exception 'VIPER_LOCATION_CHANGED'; end if;
 end loop;
 -- Recheck age AFTER lock waits, immediately before writes.
 if ord.source='shopify' and observed_at < clock_timestamp()-interval '30 seconds' then raise exception 'VIPER_SOURCE_EXPIRED'; end if;
 result:=private.apply_viper_pick_command(job.id,requested_expected_version,requested_command_id,requested_action,requested_payload,requested_actor_id);
 insert into public.viper_events(event_type,order_id,pick_job_id,actor_id,actor_type,correlation_id,source,payload)
 values('pick_source_checked',ord.id,job.id,requested_actor_id,'user',requested_command_id,'viper',
   jsonb_build_object('action',requested_action,'shopifyUpdatedAt',observed_update,'observedAt',observed_at));
 return result;
end $$;
