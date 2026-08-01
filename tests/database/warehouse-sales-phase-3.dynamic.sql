\set ON_ERROR_STOP on

set role postgres;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001');

insert into public.profiles (id, email, role, display_name, active) values
  ('00000000-0000-4000-8000-000000000001', 'phase3@example.test',
   'admin', 'Phase 3 Test', true);

insert into public.shopify_connections (
  shop, access_token, scopes, inventory_location_id,
  inventory_location_name, inventory_location_configured_at
) values (
  'phase3.myshopify.com', 'not-a-real-token', 'read_products,write_inventory',
  'gid://shopify/Location/100', 'Isolated test location', now()
);

insert into public.zones (id, code, name) values
  ('10000000-0000-4000-8000-000000000001', 'TST', 'Test');

insert into public.locations (id, code, zone_id) values
  ('20000000-0000-4000-8000-000000000001', 'PRIMARY',
   '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'SECONDARY',
   '10000000-0000-4000-8000-000000000001');

create function pg_temp.add_product(
  product_id uuid,
  product_sku text,
  product_name text,
  primary_quantity integer,
  secondary_quantity integer default 0
) returns void
language plpgsql
as $$
begin
  insert into public.products (
    id, sku, product_name, active, shopify_inventory_item_id,
    shopify_price_minor, shopify_price_currency,
    shopify_inventory_tracked, shopify_inventory_level_id,
    shopify_inventory_location_id, shopify_inventory_observed_at
  ) values (
    product_id, product_sku, product_name, true,
    'gid://shopify/InventoryItem/' || replace(product_id::text, '-', ''),
    10000, 'NOK', true,
    'gid://shopify/InventoryLevel/' || replace(product_id::text, '-', ''),
    'gid://shopify/Location/100', now()
  );

  insert into public.inventory (
    id, product_id, location_id, quantity, is_primary, zone_id, created_at
  ) values (
    ('30000000-0000-4000-8000-' || right(replace(product_id::text, '-', ''), 12))::uuid,
    product_id, '20000000-0000-4000-8000-000000000001',
    primary_quantity, true, '10000000-0000-4000-8000-000000000001',
    '2026-01-01 00:00:00+00'
  );

  if secondary_quantity > 0 then
    insert into public.inventory (
      id, product_id, location_id, quantity, is_primary, zone_id, created_at
    ) values (
      ('40000000-0000-4000-8000-' || right(replace(product_id::text, '-', ''), 12))::uuid,
      product_id, '20000000-0000-4000-8000-000000000002',
      secondary_quantity, false, '10000000-0000-4000-8000-000000000001',
      '2026-01-02 00:00:00+00'
    );
  end if;
end;
$$;

select pg_temp.add_product(
  '50000000-0000-4000-8000-000000000001', 'MULTI-A', 'Multi A', 2, 4
);
select pg_temp.add_product(
  '50000000-0000-4000-8000-000000000002', 'MULTI-B', 'Multi B', 5, 0
);

do $$
declare
  result jsonb;
  replay jsonb;
  completed_id uuid;
begin
  result := public.complete_warehouse_sale(
    '60000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    'vipps',
    jsonb_build_array(
      jsonb_build_object(
        'productId', '50000000-0000-4000-8000-000000000002',
        'quantity', 2, 'unitPriceMinor', 7500
      ),
      jsonb_build_object(
        'productId', '50000000-0000-4000-8000-000000000001',
        'quantity', 5, 'unitPriceMinor', 9000
      )
    ),
    'phase3.myshopify.com',
    '00000000-0000-4000-8000-000000000001',
    'phase3@example.test',
    'Phase 3 Test'
  );
  completed_id := (result ->> 'saleId')::uuid;

  assert result ->> 'idempotentReplay' = 'false';
  assert (result ->> 'totalAmountMinor')::bigint = 60000;
  assert (result ->> 'totalQuantity')::integer = 7;
  assert (select count(*) from public.warehouse_sale_lines
          where sale_id = completed_id) = 2;
  assert (select count(*) from public.stock_movements
          where warehouse_sale_id = completed_id) = 3;
  assert (select count(*) from public.warehouse_sale_shopify_sync_jobs
          where warehouse_sale_id = completed_id and status = 'pending') = 1;
  assert (select count(*) from public.activity_log
          where entity_id = completed_id and action = 'warehouse_sale_completed') = 1;
  assert (select quantity from public.inventory
          where product_id = '50000000-0000-4000-8000-000000000001'
            and is_primary) = 0;
  assert (select quantity from public.inventory
          where product_id = '50000000-0000-4000-8000-000000000001'
            and not is_primary) = 1;
  assert (select quantity from public.inventory
          where product_id = '50000000-0000-4000-8000-000000000002') = 3;
  assert (select payload ->> 'locationId'
          from public.warehouse_sale_shopify_sync_jobs
          where warehouse_sale_id = completed_id) = 'gid://shopify/Location/100';
  assert (select sum((change ->> 'delta')::integer)
          from public.warehouse_sale_shopify_sync_jobs as job,
               jsonb_array_elements(job.payload -> 'changes') as change
          where job.warehouse_sale_id = completed_id) = -7;

  replay := public.complete_warehouse_sale(
    '60000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    'vipps',
    jsonb_build_array(
      jsonb_build_object(
        'productId', '50000000-0000-4000-8000-000000000001',
        'quantity', 5, 'unitPriceMinor', 9000
      ),
      jsonb_build_object(
        'productId', '50000000-0000-4000-8000-000000000002',
        'quantity', 2, 'unitPriceMinor', 7500
      )
    ),
    'phase3.myshopify.com',
    '00000000-0000-4000-8000-000000000001',
    'phase3@example.test',
    'Phase 3 Test'
  );
  assert replay ->> 'idempotentReplay' = 'true';
  assert replay ->> 'saleId' = completed_id::text;
  assert (select count(*) from public.warehouse_sales
          where idempotency_key = '60000000-0000-4000-8000-000000000001') = 1;

  begin
    perform public.complete_warehouse_sale(
      '60000000-0000-4000-8000-000000000001', repeat('b', 64), 'vipps',
      jsonb_build_array(jsonb_build_object(
        'productId', '50000000-0000-4000-8000-000000000001',
        'quantity', 1, 'unitPriceMinor', 1
      )),
      'phase3.myshopify.com',
      '00000000-0000-4000-8000-000000000001',
      'phase3@example.test', 'Phase 3 Test'
    );
    assert false, 'changed payload should conflict';
  exception when others then
    assert sqlerrm like '%idempotency key reuse conflict%';
  end;
end;
$$;

select pg_temp.add_product(
  '50000000-0000-4000-8000-000000000003', 'LOW', 'Low stock', 1, 0
);

do $$
declare
  sales_before bigint := (select count(*) from public.warehouse_sales);
  movements_before bigint := (select count(*) from public.stock_movements);
  jobs_before bigint := (select count(*) from public.warehouse_sale_shopify_sync_jobs);
begin
  begin
    perform public.complete_warehouse_sale(
      '60000000-0000-4000-8000-000000000002', repeat('c', 64), 'vipps',
      jsonb_build_array(jsonb_build_object(
        'productId', '50000000-0000-4000-8000-000000000003',
        'quantity', 2, 'unitPriceMinor', 100
      )),
      'phase3.myshopify.com',
      '00000000-0000-4000-8000-000000000001',
      'phase3@example.test', 'Phase 3 Test'
    );
    assert false, 'insufficient inventory should fail';
  exception when others then
    assert sqlerrm like 'Insufficient inventory%';
  end;

  assert (select count(*) from public.warehouse_sales) = sales_before;
  assert (select count(*) from public.stock_movements) = movements_before;
  assert (select count(*) from public.warehouse_sale_shopify_sync_jobs) = jobs_before;
  assert (select quantity from public.inventory
          where product_id = '50000000-0000-4000-8000-000000000003') = 1;
end;
$$;

select pg_temp.add_product(
  '50000000-0000-4000-8000-000000000004', 'ROLL-A', 'Rollback A', 3, 0
);
select pg_temp.add_product(
  '50000000-0000-4000-8000-000000000005', 'ROLL-B', 'Rollback B', 3, 0
);

create function pg_temp.fail_second_movement()
returns trigger
language plpgsql
as $$
begin
  if new.product_id = '50000000-0000-4000-8000-000000000005' then
    raise exception 'Injected movement failure';
  end if;
  return new;
end;
$$;

create trigger phase3_injected_failure
before insert on public.stock_movements
for each row execute function pg_temp.fail_second_movement();

do $$
declare
  sales_before bigint := (select count(*) from public.warehouse_sales);
  movements_before bigint := (select count(*) from public.stock_movements);
begin
  begin
    perform public.complete_warehouse_sale(
      '60000000-0000-4000-8000-000000000003', repeat('d', 64), 'vipps',
      jsonb_build_array(
        jsonb_build_object(
          'productId', '50000000-0000-4000-8000-000000000004',
          'quantity', 2, 'unitPriceMinor', 100
        ),
        jsonb_build_object(
          'productId', '50000000-0000-4000-8000-000000000005',
          'quantity', 2, 'unitPriceMinor', 100
        )
      ),
      'phase3.myshopify.com',
      '00000000-0000-4000-8000-000000000001',
      'phase3@example.test', 'Phase 3 Test'
    );
    assert false, 'injected movement failure should fail';
  exception when others then
    assert sqlerrm = 'Injected movement failure';
  end;

  assert (select count(*) from public.warehouse_sales) = sales_before;
  assert (select count(*) from public.stock_movements) = movements_before;
  assert (select count(*) from public.warehouse_sale_shopify_sync_jobs
          where warehouse_sale_id in (
            select id from public.warehouse_sales
            where idempotency_key = '60000000-0000-4000-8000-000000000003'
          )) = 0;
  assert (select quantity from public.inventory
          where product_id = '50000000-0000-4000-8000-000000000004') = 3;
  assert (select quantity from public.inventory
          where product_id = '50000000-0000-4000-8000-000000000005') = 3;
end;
$$;

drop trigger phase3_injected_failure on public.stock_movements;

\echo 'phase3 sequential dynamic assertions passed'
