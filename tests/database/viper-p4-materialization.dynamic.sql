\set ON_ERROR_STOP on

set role postgres;

insert into auth.users (id) values ('70000000-0000-4000-8000-000000000001');
insert into public.profiles (id, email, role, display_name, active) values (
  '70000000-0000-4000-8000-000000000001', 'viper-p4@example.test',
  'admin', 'Viper P4 Test', true
);
insert into public.zones (id, code, name) values (
  '71000000-0000-4000-8000-000000000001', 'VP4', 'Viper P4'
);
insert into public.locations (id, code, zone_id) values (
  '72000000-0000-4000-8000-000000000001', 'VP4-A-01',
  '71000000-0000-4000-8000-000000000001'
);
insert into public.products (
  id, sku, product_name, variant_name, active, shopify_variant_id
) values
  ('73000000-0000-4000-8000-000000000001', 'VP4-A', 'Viper Product A', 'Blue', true,
   'gid://shopify/ProductVariant/401'),
  ('73000000-0000-4000-8000-000000000002', 'VP4-B', 'Viper Product B', null, true,
   'gid://shopify/ProductVariant/402'),
  ('73000000-0000-4000-8000-000000000003', 'VP4-C', 'Viper Product C', null, true,
   'gid://shopify/ProductVariant/403');
insert into public.inventory (
  id, product_id, location_id, quantity, is_primary, zone_id
) values
  ('74000000-0000-4000-8000-000000000001',
   '73000000-0000-4000-8000-000000000001',
   '72000000-0000-4000-8000-000000000001', 8, true,
   '71000000-0000-4000-8000-000000000001'),
  ('74000000-0000-4000-8000-000000000002',
   '73000000-0000-4000-8000-000000000002',
   '72000000-0000-4000-8000-000000000001', 6, true,
   '71000000-0000-4000-8000-000000000001'),
  ('74000000-0000-4000-8000-000000000003',
   '73000000-0000-4000-8000-000000000003',
   '72000000-0000-4000-8000-000000000001', 1, true,
   '71000000-0000-4000-8000-000000000001');

do $$
declare
  result jsonb;
  replay jsonb;
  imported_order_id uuid;
  imported_job_id uuid;
  orders_before bigint;
  events_before bigint;
begin
  result := public.materialize_viper_shopify_order(
    'gid://shopify/Order/9001', '#VP4-9001',
    '2026-07-31 10:05:00+00', '2026-07-31 10:00:00+00',
    jsonb_build_array(
      jsonb_build_object(
        'externalLineId', 'gid://shopify/LineItem/901',
        'shopifyVariantId', 'gid://shopify/ProductVariant/401',
        'sku', 'VP4-A', 'productName', 'Viper Product A',
        'variantName', 'Blue', 'requestedQuantity', 2, 'sequenceNumber', 1
      ),
      jsonb_build_object(
        'externalLineId', 'gid://shopify/LineItem/902',
        'shopifyVariantId', 'gid://shopify/ProductVariant/402',
        'sku', 'VP4-B', 'productName', 'Viper Product B',
        'variantName', null, 'requestedQuantity', 3, 'sequenceNumber', 2
      )
    ),
    '70000000-0000-4000-8000-000000000001',
    'viper-p4@example.test', 'Viper P4 Test',
    '75000000-0000-4000-8000-000000000001'
  );
  imported_order_id := (result ->> 'orderId')::uuid;
  imported_job_id := (result ->> 'pickJobId')::uuid;

  assert result ->> 'idempotent' = 'false';
  assert result ->> 'orderStatus' = 'ready_to_pick';
  assert result ->> 'pickJobStatus' = 'ready';
  assert (select count(*) from public.order_lines where order_id = imported_order_id) = 2;
  assert (select count(*) from public.pick_lines where pick_job_id = imported_job_id) = 2;
  assert (select count(*) from public.viper_events where order_id = imported_order_id) = 2;
  assert (select string_agg(event_type, '>' order by event_sequence)
          from public.viper_events where order_id = imported_order_id)
         = 'order_imported>pick_job_created';
  assert (select count(*) from public.activity_log
          where entity_id = imported_order_id and action = 'viper_order_imported') = 1;
  assert (select quantity from public.inventory
          where id = '74000000-0000-4000-8000-000000000001') = 8;
  assert (select quantity from public.inventory
          where id = '74000000-0000-4000-8000-000000000002') = 6;

  replay := public.materialize_viper_shopify_order(
    'gid://shopify/Order/9001', '#VP4-9001',
    '2026-07-31 10:05:00+00', '2026-07-31 10:00:00+00',
    jsonb_build_array(jsonb_build_object(
      'externalLineId', 'ignored-on-idempotent-replay',
      'shopifyVariantId', 'gid://shopify/ProductVariant/401',
      'sku', 'VP4-A', 'productName', 'Viper Product A',
      'requestedQuantity', 2, 'sequenceNumber', 1
    )),
    '70000000-0000-4000-8000-000000000001',
    'viper-p4@example.test', 'Viper P4 Test',
    '75000000-0000-4000-8000-000000000002'
  );
  assert replay ->> 'idempotent' = 'true';
  assert replay ->> 'orderId' = imported_order_id::text;
  assert (select count(*) from public.orders
          where source = 'shopify' and external_order_id = 'gid://shopify/Order/9001') = 1;
  assert (select count(*) from public.pick_jobs where order_id = imported_order_id) = 1;
  assert (select count(*) from public.viper_events where order_id = imported_order_id) = 2;

  orders_before := (select count(*) from public.orders);
  events_before := (select count(*) from public.viper_events);
  begin
    perform public.materialize_viper_shopify_order(
      'gid://shopify/Order/9001', '#VP4-9001',
      '2026-07-31 10:06:00+00', '2026-07-31 10:00:00+00',
      jsonb_build_array(jsonb_build_object(
        'externalLineId', 'gid://shopify/LineItem/901',
        'shopifyVariantId', 'gid://shopify/ProductVariant/401',
        'sku', 'VP4-A', 'productName', 'Viper Product A',
        'requestedQuantity', 2, 'sequenceNumber', 1
      )),
      '70000000-0000-4000-8000-000000000001'
    );
    assert false, 'changed updatedAt must fail';
  exception when others then
    assert sqlerrm like '%different updatedAt%';
  end;
  assert (select count(*) from public.orders) = orders_before;
  assert (select count(*) from public.viper_events) = events_before;

  begin
    perform public.materialize_viper_shopify_order(
      'gid://shopify/Order/9002', '#VP4-9002',
      '2026-07-31 11:05:00+00', '2026-07-31 11:00:00+00',
      jsonb_build_array(
        jsonb_build_object(
          'externalLineId', 'gid://shopify/LineItem/911',
          'shopifyVariantId', 'gid://shopify/ProductVariant/401',
          'sku', 'VP4-A', 'productName', 'Viper Product A',
          'requestedQuantity', 1, 'sequenceNumber', 1
        ),
        jsonb_build_object(
          'externalLineId', 'gid://shopify/LineItem/912',
          'shopifyVariantId', 'gid://shopify/ProductVariant/999',
          'sku', 'UNKNOWN', 'productName', 'Unknown',
          'requestedQuantity', 1, 'sequenceNumber', 2
        )
      ),
      '70000000-0000-4000-8000-000000000001'
    );
    assert false, 'one invalid line must reject the order';
  exception when others then
    assert sqlerrm like 'Shopify variant is not mapped%';
  end;
  assert not exists (
    select 1 from public.orders where external_order_id = 'gid://shopify/Order/9002'
  );
end;
$$;

create function pg_temp.fail_viper_second_pick_line()
returns trigger language plpgsql as $$
begin
  if new.product_id = '73000000-0000-4000-8000-000000000002' then
    raise exception 'Injected Viper pick-line failure';
  end if;
  return new;
end;
$$;
create trigger viper_p4_injected_failure
before insert on public.pick_lines
for each row execute function pg_temp.fail_viper_second_pick_line();

do $$
begin
  begin
    perform public.materialize_viper_shopify_order(
      'gid://shopify/Order/9003', '#VP4-9003',
      '2026-07-31 12:05:00+00', '2026-07-31 12:00:00+00',
      jsonb_build_array(
        jsonb_build_object(
          'externalLineId', 'gid://shopify/LineItem/921',
          'shopifyVariantId', 'gid://shopify/ProductVariant/401',
          'sku', 'VP4-A', 'productName', 'Viper Product A',
          'requestedQuantity', 1, 'sequenceNumber', 1
        ),
        jsonb_build_object(
          'externalLineId', 'gid://shopify/LineItem/922',
          'shopifyVariantId', 'gid://shopify/ProductVariant/402',
          'sku', 'VP4-B', 'productName', 'Viper Product B',
          'requestedQuantity', 1, 'sequenceNumber', 2
        )
      ),
      '70000000-0000-4000-8000-000000000001'
    );
    assert false, 'injected failure must abort materialization';
  exception when others then
    assert sqlerrm = 'Injected Viper pick-line failure';
  end;
  assert not exists (
    select 1 from public.orders where external_order_id = 'gid://shopify/Order/9003'
  );
  assert not exists (
    select 1 from public.viper_events
    where idempotency_key in (
      'order-imported:gid://shopify/Order/9003',
      'pick-job-created:gid://shopify/Order/9003'
    )
  );
end;
$$;

drop trigger viper_p4_injected_failure on public.pick_lines;

\echo 'Viper P4.2 sequential dynamic assertions passed'
