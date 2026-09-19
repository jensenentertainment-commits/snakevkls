\set ON_ERROR_STOP on
-- Isolated-target guard executes before any writes through the helper chain.
\ir roy-phase-2a-catalog-foundation.helpers.sql
create function phase2a_test.read_target(sku text, actor text default '96000000-0000-4000-8000-000000000001')
returns jsonb language plpgsql as $$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.sub', actor, true);
  set local role authenticated;
  result := public.get_roy_targeted_product_v1(sku);
  reset role;
  return result;
exception when others then reset role; raise;
end;
$$;
