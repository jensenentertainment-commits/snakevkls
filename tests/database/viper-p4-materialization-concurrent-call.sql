\set ON_ERROR_STOP on
set statement_timeout = '10s';
set role service_role;

select public.materialize_viper_shopify_order(
  'gid://shopify/Order/9010', '#VP4-9010',
  '2026-07-31 13:05:00+00', '2026-07-31 13:00:00+00',
  jsonb_build_array(jsonb_build_object(
    'externalLineId', 'gid://shopify/LineItem/931',
    'shopifyVariantId', 'gid://shopify/ProductVariant/403',
    'sku', 'VP4-C', 'productName', 'Viper Product C',
    'requestedQuantity', 1, 'sequenceNumber', 1
  )),
  '70000000-0000-4000-8000-000000000001',
  'viper-p4@example.test', 'Viper P4 Test',
  :'correlation_id'::uuid
);
