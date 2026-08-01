-- Warehouse sales Phase 3 runtime corrections.
-- Keep the original migration immutable; replace the function with unambiguous
-- PL/pgSQL variable names discovered by dynamic PostgreSQL verification.

-- Warehouse sales Phase 3: one atomic local completion contract.
-- Shopify is never called here. The transaction only creates a pending outbox
-- job containing the immutable negative deltas to send later.

create or replace function public.complete_warehouse_sale(
  requested_idempotency_key uuid,
  requested_request_hash text,
  requested_payment_method text,
  requested_lines jsonb,
  requested_shop text,
  requested_actor_id uuid,
  requested_actor_email text default null,
  requested_actor_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_sale public.warehouse_sales%rowtype;
  existing_sync_status text;
  connection_row public.shopify_connections%rowtype;
  requested_line jsonb;
  sale_line record;
  inventory_row record;
  actor_name text := nullif(btrim(requested_actor_name), '');
  normalized_lines jsonb;
  product_ids uuid[];
  completed_sale_id uuid := gen_random_uuid();
  sale_line_id uuid;
  sale_number text;
  completed_timestamp timestamptz := statement_timestamp();
  total_amount bigint := 0;
  total_quantity_bigint bigint := 0;
  requested_line_count integer;
  locked_product_count integer;
  available_quantity bigint;
  remaining_quantity integer;
  deduct_quantity integer;
  outbox_payload jsonb;
  outbox_id uuid;
  outbox_idempotency_key uuid := gen_random_uuid();
  outbox_payload_hash text;
begin
  if requested_idempotency_key is null then
    raise exception 'Warehouse sale idempotency key is required';
  end if;

  if requested_request_hash is null
    or requested_request_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Warehouse sale request hash is invalid';
  end if;

  if requested_payment_method <> 'vipps' then
    raise exception 'Warehouse sale payment method is invalid';
  end if;

  if requested_actor_id is null then
    raise exception 'Warehouse sale actor is required';
  end if;

  if actor_name is null then
    raise exception 'Warehouse sale actor name is required';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = requested_actor_id
      and profile.active is true
      and profile.role in ('admin', 'lager')
  ) then
    raise exception 'Warehouse sale actor is not authorized';
  end if;

  if jsonb_typeof(requested_lines) <> 'array' then
    raise exception 'Warehouse sale lines must be an array';
  end if;

  requested_line_count := jsonb_array_length(requested_lines);
  if requested_line_count < 1 or requested_line_count > 100 then
    raise exception 'Warehouse sale must contain between 1 and 100 lines';
  end if;

  for requested_line in
    select value
    from jsonb_array_elements(requested_lines)
  loop
    if jsonb_typeof(requested_line) <> 'object'
      or jsonb_typeof(requested_line -> 'productId') <> 'string'
      or (requested_line ->> 'productId') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or jsonb_typeof(requested_line -> 'quantity') <> 'number'
      or (requested_line ->> 'quantity') !~ '^[0-9]+$'
      or (requested_line ->> 'quantity')::bigint < 1
      or (requested_line ->> 'quantity')::bigint > 2147483647
      or jsonb_typeof(requested_line -> 'unitPriceMinor') <> 'number'
      or (requested_line ->> 'unitPriceMinor') !~ '^[0-9]+$'
      or (requested_line ->> 'unitPriceMinor')::numeric > 9223372036854775807
    then
      raise exception 'Warehouse sale contains an invalid line';
    end if;
  end loop;

  select
    jsonb_agg(
      jsonb_build_object(
        'product_id', (normalized_input ->> 'productId')::uuid,
        'quantity', (normalized_input ->> 'quantity')::integer,
        'unit_price_minor', (normalized_input ->> 'unitPriceMinor')::bigint
      )
      order by (normalized_input ->> 'productId')::uuid
    ),
    array_agg(
      (normalized_input ->> 'productId')::uuid
      order by (normalized_input ->> 'productId')::uuid
    )
  into normalized_lines, product_ids
  from jsonb_array_elements(requested_lines) as requested(normalized_input);

  if cardinality(product_ids) <> (
    select count(distinct product_id)
    from unnest(product_ids) as product(product_id)
  ) then
    raise exception 'Warehouse sale contains duplicate products';
  end if;

  -- Serialize only retries that share the same local idempotency key.
  perform pg_advisory_xact_lock(
    hashtextextended(requested_idempotency_key::text, 0)
  );

  select * into existing_sale
  from public.warehouse_sales
  where idempotency_key = requested_idempotency_key
  for update;

  if found then
    if existing_sale.request_hash <> requested_request_hash
      or existing_sale.completed_by <> requested_actor_id
    then
      raise exception 'Warehouse sale idempotency key reuse conflict';
    end if;

    select status into existing_sync_status
    from public.warehouse_sale_shopify_sync_jobs
    where warehouse_sale_id = existing_sale.id;

    if not found then
      raise exception 'Completed warehouse sale is missing its Shopify job';
    end if;

    return jsonb_build_object(
      'saleId', existing_sale.id,
      'saleNumber', existing_sale.sale_number,
      'status', existing_sale.status,
      'totalAmountMinor', existing_sale.total_amount_minor,
      'totalQuantity', existing_sale.total_quantity,
      'lineCount', existing_sale.line_count,
      'completedAt', existing_sale.completed_at,
      'shopifySyncStatus', existing_sync_status,
      'idempotentReplay', true
    );
  end if;

  select * into connection_row
  from public.shopify_connections
  where shop = requested_shop
  for share;

  if not found
    or connection_row.inventory_location_id is null
    or connection_row.inventory_location_configured_at is null
  then
    raise exception 'Shopify inventory location is not configured';
  end if;

  if not (
    'write_inventory' = any (
      regexp_split_to_array(coalesce(connection_row.scopes, ''), '\s*,\s*')
    )
  ) then
    raise exception 'Shopify connection is missing write_inventory';
  end if;

  -- Lock every product in UUID order. Besides stable deadlock ordering, this
  -- prevents a concurrent inventory insert from changing the allocation set.
  perform product.id
  from public.products as product
  where product.id = any(product_ids)
  order by product.id
  for update;
  get diagnostics locked_product_count = row_count;

  if locked_product_count <> requested_line_count then
    raise exception 'Warehouse sale contains an unknown product';
  end if;

  if exists (
    select 1
    from public.products as product
    where product.id = any(product_ids)
      and (
        product.active is not true
        or product.shopify_price_minor is null
        or product.shopify_price_currency <> 'NOK'
        or product.shopify_inventory_item_id is null
        or product.shopify_inventory_tracked is not true
        or product.shopify_inventory_level_id is null
        or product.shopify_inventory_location_id is distinct from
          connection_row.inventory_location_id
      )
  ) then
    raise exception 'Warehouse sale contains a product that is not sellable';
  end if;

  -- Viper locks inventory IDs in ascending order. Use the same global order
  -- here before any validation or deduction to prevent cross-flow deadlocks.
  perform inventory.id
  from public.inventory as inventory
  where inventory.product_id = any(product_ids)
  order by inventory.id
  for update;

  for sale_line in
    select
      normalized.product_id,
      normalized.quantity,
      normalized.unit_price_minor
    from jsonb_to_recordset(normalized_lines) as normalized(
      product_id uuid,
      quantity integer,
      unit_price_minor bigint
    )
    order by normalized.product_id
  loop
    select coalesce(sum(inventory.quantity), 0)
    into available_quantity
    from public.inventory as inventory
    where inventory.product_id = sale_line.product_id;

    if available_quantity < sale_line.quantity then
      raise exception 'Insufficient inventory for warehouse sale product %',
        sale_line.product_id;
    end if;

    total_amount :=
      total_amount
      + sale_line.unit_price_minor * sale_line.quantity::bigint;
    total_quantity_bigint :=
      total_quantity_bigint + sale_line.quantity::bigint;
  end loop;

  if total_quantity_bigint > 2147483647 then
    raise exception 'Warehouse sale total quantity is too large';
  end if;

  sale_number :=
    'LS-'
    || to_char(completed_timestamp, 'YYYY')
    || '-'
    || lpad(
      nextval('public.warehouse_sale_number_seq'::regclass)::text,
      8,
      '0'
    );

  insert into public.warehouse_sales (
    id,
    sale_number,
    status,
    payment_method,
    currency,
    total_amount_minor,
    total_quantity,
    line_count,
    completed_at,
    completed_by,
    completed_by_name,
    idempotency_key,
    request_hash
  ) values (
    completed_sale_id,
    sale_number,
    'completed',
    requested_payment_method,
    'NOK',
    total_amount,
    total_quantity_bigint::integer,
    requested_line_count,
    completed_timestamp,
    requested_actor_id,
    actor_name,
    requested_idempotency_key,
    requested_request_hash
  );

  insert into public.warehouse_sale_lines (
    sale_id,
    line_number,
    product_id,
    sku,
    product_name,
    variant_name,
    standard_unit_price_minor,
    unit_price_minor,
    quantity
  )
  select
    completed_sale_id,
    row_number() over (order by normalized.product_id)::integer,
    product.id,
    product.sku,
    product.product_name,
    product.variant_name,
    product.shopify_price_minor,
    normalized.unit_price_minor,
    normalized.quantity
  from jsonb_to_recordset(normalized_lines) as normalized(
    product_id uuid,
    quantity integer,
    unit_price_minor bigint
  )
  join public.products as product on product.id = normalized.product_id
  order by normalized.product_id;

  for sale_line in
    select
      warehouse_line.id,
      warehouse_line.product_id,
      warehouse_line.quantity
    from public.warehouse_sale_lines as warehouse_line
    where warehouse_line.sale_id = completed_sale_id
    order by warehouse_line.product_id
  loop
    remaining_quantity := sale_line.quantity;

    for inventory_row in
      select inventory.id, inventory.quantity
      from public.inventory as inventory
      where inventory.product_id = sale_line.product_id
        and inventory.quantity > 0
      order by
        inventory.is_primary desc,
        inventory.created_at,
        inventory.id
    loop
      exit when remaining_quantity = 0;

      deduct_quantity :=
        least(remaining_quantity, inventory_row.quantity);

      update public.inventory
      set quantity = quantity - deduct_quantity,
          updated_at = now()
      where id = inventory_row.id;

      insert into public.stock_movements (
        product_id,
        inventory_id,
        quantity_delta,
        reason,
        note,
        warehouse_sale_id,
        warehouse_sale_line_id
      ) values (
        sale_line.product_id,
        inventory_row.id,
        -deduct_quantity,
        'warehouse_sale',
        'Lagersalg ' || sale_number,
        completed_sale_id,
        sale_line.id
      );

      remaining_quantity := remaining_quantity - deduct_quantity;
    end loop;

    if remaining_quantity <> 0 then
      raise exception 'Warehouse sale allocation failed for product %',
        sale_line.product_id;
    end if;
  end loop;

  select jsonb_build_object(
    'schemaVersion', 1,
    'locationId', connection_row.inventory_location_id,
    'changes', jsonb_agg(
      jsonb_build_object(
        'productId', warehouse_line.product_id,
        'saleLineId', warehouse_line.id,
        'inventoryItemId', product.shopify_inventory_item_id,
        'delta', -warehouse_line.quantity
      )
      order by warehouse_line.line_number
    )
  )
  into outbox_payload
  from public.warehouse_sale_lines as warehouse_line
  join public.products as product on product.id = warehouse_line.product_id
  where warehouse_line.sale_id = completed_sale_id;

  outbox_payload_hash :=
    md5(outbox_payload::text)
    || md5('snake-warehouse-sale:' || outbox_payload::text);

  insert into public.warehouse_sale_shopify_sync_jobs (
    warehouse_sale_id,
    shop,
    shopify_location_id,
    status,
    idempotency_key,
    reference_document_uri,
    payload,
    payload_hash
  ) values (
    completed_sale_id,
    connection_row.shop,
    connection_row.inventory_location_id,
    'pending',
    outbox_idempotency_key,
    'snake://warehouse-sale/' || completed_sale_id::text,
    outbox_payload,
    outbox_payload_hash
  )
  returning id into outbox_id;

  insert into public.activity_log (
    entity_type,
    entity_id,
    action,
    title,
    description,
    metadata,
    actor_id,
    actor_email,
    actor_name
  ) values (
    'warehouse_sale',
    completed_sale_id,
    'warehouse_sale_completed',
    'Lagersalg ' || sale_number || ' fullført',
    total_quantity_bigint::text
      || ' varer · '
      || to_char(total_amount / 100.0, 'FM999999999990D00')
      || ' kr · Vipps',
    jsonb_build_object(
      'saleId', completed_sale_id,
      'saleNumber', sale_number,
      'totalAmountMinor', total_amount,
      'totalQuantity', total_quantity_bigint,
      'lineCount', requested_line_count,
      'paymentMethod', requested_payment_method,
      'shopifySyncJobId', outbox_id,
      'shopifySyncStatus', 'pending',
      'idempotencyKey', requested_idempotency_key
    ),
    requested_actor_id,
    requested_actor_email,
    actor_name
  );

  return jsonb_build_object(
    'saleId', completed_sale_id,
    'saleNumber', sale_number,
    'status', 'completed',
    'totalAmountMinor', total_amount,
    'totalQuantity', total_quantity_bigint,
    'lineCount', requested_line_count,
    'completedAt', completed_timestamp,
    'shopifySyncStatus', 'pending',
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.complete_warehouse_sale(
  uuid, text, text, jsonb, text, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.complete_warehouse_sale(
  uuid, text, text, jsonb, text, uuid, text, text
) to service_role;
