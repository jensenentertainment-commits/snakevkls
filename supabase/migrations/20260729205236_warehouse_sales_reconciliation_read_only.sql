-- Keep the reconciliation view read-only even when project-level default
-- privileges grant broader access to newly created public relations.
revoke all on public.warehouse_sale_shopify_reconciliation
from public, anon, authenticated, service_role;

grant select on public.warehouse_sale_shopify_reconciliation
to authenticated, service_role;

notify pgrst, 'reload schema';
