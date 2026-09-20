-- READ ONLY. Future operator use only; requires an explicitly approved database
-- connection with permission to SET ROLE authenticated and invoke the oracle.
-- psql -X -qAt -v ON_ERROR_STOP=1 -v operation=UUID -v profile=ACTIVE_ADMIN_UUID
--   -f scripts/roy-phase2a/proof-snapshot.sql > restricted-snapshot.json
-- Supply credentials through approved secret handling, never command arguments.
\set ON_ERROR_STOP on
begin isolation level repeatable read read only;
set local timezone='UTC';
select public.get_shopify_backfill_proof_facts_v1(:'operation'::uuid)::text as facts \gset
select set_config('request.jwt.claim.sub', :'profile', true) as ignored \gset
set local role authenticated;
-- Reader authorization/RLS is exercised as the explicit profile, not service_role.
select jsonb_build_object('schemaVersion',1,'snapshotIsolation',current_setting('transaction_isolation'),
  'readOnly',current_setting('transaction_read_only'),'database',current_database(),
  'snapshot',pg_current_snapshot()::text,'facts',:'facts'::jsonb,
  'aggregate',public.get_roy_catalog_foundation_v1(),
  'targets',(select coalesce(jsonb_agg(jsonb_build_object('sku',t.value->>'sku','result',public.get_roy_targeted_product_v1(t.value->>'sku')) order by t.ordinality),'[]')
    from jsonb_array_elements(:'facts'::jsonb->'targets') with ordinality t(value,ordinality)));
rollback;
