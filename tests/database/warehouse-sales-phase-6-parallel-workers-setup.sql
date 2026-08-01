\set ON_ERROR_STOP on

set role service_role;

select public.complete_warehouse_sale(
  '60000000-0000-4000-8000-000000000020',
  repeat('4', 64),
  'vipps',
  '[{"productId":"50000000-0000-4000-8000-000000000001","quantity":1,"unitPriceMinor":100}]',
  'phase3.myshopify.com',
  '00000000-0000-4000-8000-000000000001',
  'phase3@example.test',
  'Phase 3 Test'
);

select public.complete_warehouse_sale(
  '60000000-0000-4000-8000-000000000021',
  repeat('5', 64),
  'vipps',
  '[{"productId":"50000000-0000-4000-8000-000000000002","quantity":1,"unitPriceMinor":100}]',
  'phase3.myshopify.com',
  '00000000-0000-4000-8000-000000000001',
  'phase3@example.test',
  'Phase 3 Test'
);

