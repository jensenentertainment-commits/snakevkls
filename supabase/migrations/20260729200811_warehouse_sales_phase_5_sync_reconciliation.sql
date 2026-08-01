-- Warehouse sales Phase 5: explain the temporary gap between Snake's
-- authoritative physical stock and location-specific Shopify observations.

create view public.warehouse_sale_shopify_reconciliation
with (security_invoker = true)
as
with physical as (
  select inventory.product_id, coalesce(sum(inventory.quantity), 0)::bigint
    as physical_quantity
  from public.inventory as inventory
  group by inventory.product_id
),
outbound as (
  select
    (change.value ->> 'productId')::uuid as product_id,
    sum((change.value ->> 'delta')::bigint) filter (
      where job.status <> 'synced'
        or product.shopify_inventory_observed_at is null
        or job.synced_at >= product.shopify_inventory_observed_at
    ) as unobserved_outbound_delta,
    bool_or(job.status = 'failed') filter (
      where job.status <> 'synced'
    ) as has_failed_outbound,
    bool_or(job.status in ('pending', 'processing')) as has_pending_outbound,
    max(job.synced_at) filter (where job.status = 'synced')
      as latest_outbound_synced_at
  from public.warehouse_sale_shopify_sync_jobs as job
  cross join lateral jsonb_array_elements(job.payload -> 'changes') as change(value)
  join public.products as product
    on product.id = (change.value ->> 'productId')::uuid
   and product.shopify_inventory_location_id = job.shopify_location_id
  group by (change.value ->> 'productId')::uuid
)
select
  product.id as product_id,
  product.shopify_inventory_location_id as shopify_location_id,
  coalesce(physical.physical_quantity, 0) as physical_quantity,
  product.shopify_quantity as observed_shopify_quantity,
  product.shopify_inventory_observed_at as observed_at,
  coalesce(outbound.unobserved_outbound_delta, 0)
    as unobserved_outbound_delta,
  product.shopify_quantity::bigint
    - coalesce(physical.physical_quantity, 0) as raw_difference,
  product.shopify_quantity::bigint
    + coalesce(outbound.unobserved_outbound_delta, 0)
    - coalesce(physical.physical_quantity, 0) as explained_difference,
  case
    when product.shopify_inventory_location_id is null
      or product.shopify_inventory_observed_at is null
      then 'observation_unavailable'
    when product.shopify_quantity::bigint
      = coalesce(physical.physical_quantity, 0)
      then 'in_sync'
    when coalesce(outbound.unobserved_outbound_delta, 0) <> 0
      and product.shopify_quantity::bigint
        + coalesce(outbound.unobserved_outbound_delta, 0)
        = coalesce(physical.physical_quantity, 0)
      and coalesce(outbound.has_failed_outbound, false)
      then 'outbound_failed'
    when coalesce(outbound.unobserved_outbound_delta, 0) <> 0
      and product.shopify_quantity::bigint
        + coalesce(outbound.unobserved_outbound_delta, 0)
        = coalesce(physical.physical_quantity, 0)
      then 'outbound_in_flight'
    else 'unexplained_difference'
  end as reconciliation_status,
  coalesce(outbound.has_pending_outbound, false) as has_pending_outbound,
  coalesce(outbound.has_failed_outbound, false) as has_failed_outbound,
  outbound.latest_outbound_synced_at
from public.products as product
left join physical on physical.product_id = product.id
left join outbound on outbound.product_id = product.id;

revoke all on public.warehouse_sale_shopify_reconciliation
from public, anon;
grant select on public.warehouse_sale_shopify_reconciliation
to authenticated, service_role;
