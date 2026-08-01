\set ON_ERROR_STOP on

set statement_timeout = '10s';
set role service_role;

select public.complete_warehouse_sale(
  :'idempotency_key'::uuid,
  :'request_hash',
  'vipps',
  convert_from(decode(:'lines_base64', 'base64'), 'UTF8')::jsonb,
  'phase3.myshopify.com',
  '00000000-0000-4000-8000-000000000001',
  'phase3@example.test',
  'Phase 3 Test'
);
