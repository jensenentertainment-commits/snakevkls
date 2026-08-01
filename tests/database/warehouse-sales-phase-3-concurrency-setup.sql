\set ON_ERROR_STOP on

set role postgres;

insert into public.products (
  id, sku, product_name, active, shopify_inventory_item_id,
  shopify_price_minor, shopify_price_currency, shopify_inventory_tracked,
  shopify_inventory_level_id, shopify_inventory_location_id,
  shopify_inventory_observed_at
) values
  ('50000000-0000-4000-8000-000000000006', 'CON-IDEM', 'Concurrent idem',
   true, 'gid://shopify/InventoryItem/6', 1000, 'NOK', true,
   'gid://shopify/InventoryLevel/6', 'gid://shopify/Location/100', now()),
  ('50000000-0000-4000-8000-000000000007', 'CON-STOCK', 'Concurrent stock',
   true, 'gid://shopify/InventoryItem/7', 1000, 'NOK', true,
   'gid://shopify/InventoryLevel/7', 'gid://shopify/Location/100', now()),
  ('50000000-0000-4000-8000-000000000008', 'CON-LOCK-A', 'Lock A',
   true, 'gid://shopify/InventoryItem/8', 1000, 'NOK', true,
   'gid://shopify/InventoryLevel/8', 'gid://shopify/Location/100', now()),
  ('50000000-0000-4000-8000-000000000009', 'CON-LOCK-B', 'Lock B',
   true, 'gid://shopify/InventoryItem/9', 1000, 'NOK', true,
   'gid://shopify/InventoryLevel/9', 'gid://shopify/Location/100', now());

insert into public.inventory (
  id, product_id, location_id, quantity, is_primary, zone_id
) values
  ('30000000-0000-4000-8000-000000000006',
   '50000000-0000-4000-8000-000000000006',
   '20000000-0000-4000-8000-000000000001', 10, true,
   '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000007',
   '50000000-0000-4000-8000-000000000007',
   '20000000-0000-4000-8000-000000000001', 5, true,
   '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000008',
   '50000000-0000-4000-8000-000000000008',
   '20000000-0000-4000-8000-000000000001', 10, true,
   '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000009',
   '50000000-0000-4000-8000-000000000009',
   '20000000-0000-4000-8000-000000000001', 10, true,
   '10000000-0000-4000-8000-000000000001');

create function public.phase3_test_delay_sale()
returns trigger
language plpgsql
as $$
begin
  if new.idempotency_key in (
    '60000000-0000-4000-8000-000000000010',
    '60000000-0000-4000-8000-000000000011',
    '60000000-0000-4000-8000-000000000012',
    '60000000-0000-4000-8000-000000000013',
    '60000000-0000-4000-8000-000000000014'
  ) then
    perform pg_sleep(0.75);
  end if;
  return new;
end;
$$;

create trigger phase3_test_delay_sale
before insert on public.warehouse_sales
for each row execute function public.phase3_test_delay_sale();
