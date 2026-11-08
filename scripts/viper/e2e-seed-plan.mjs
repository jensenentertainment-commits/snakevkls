// Emits SQL for review only. No database client, credentials or execution.
import {rows,zone,SYSTEM_ID,ORDER_ID} from './e2e-manifest.mjs';
export function seedSQL() {
 const json=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
 const ids=[zone.id,...rows.flatMap(r=>[r.product.id,r.location.id,r.inventory.id])];
 return `-- REVIEW ONLY: separate approval and fresh identity/order checks required.
BEGIN;
-- After separate approval, insert here: SET LOCAL viper.e2e_approval = 'seed-1001';
DO $guard$
BEGIN
 IF current_setting('viper.e2e_approval',true) IS DISTINCT FROM 'seed-1001'
 OR current_database()<>'postgres' OR (SELECT system_identifier::text FROM pg_control_system())<>'${SYSTEM_ID}' THEN RAISE EXCEPTION 'Wrong/unapproved E2E target'; END IF;
END $guard$;
LOCK TABLE public.zones,public.locations,public.products,public.inventory,public.orders,public.pick_jobs,public.shopify_connections IN SHARE ROW EXCLUSIVE MODE;
DO $seed$
DECLARE before_products bigint; before_locations bigint; before_inventory bigint;
BEGIN
 IF EXISTS(SELECT 1 FROM public.shopify_connections)
 OR EXISTS(SELECT 1 FROM public.pick_jobs WHERE status='in_progress')
 OR EXISTS(SELECT 1 FROM public.orders WHERE external_order_id='${ORDER_ID}')
 OR EXISTS(SELECT 1 FROM public.zones WHERE code='VE2E' OR pick_priority=201)
 OR EXISTS(SELECT 1 FROM public.locations WHERE code LIKE 'VE2E%')
 OR EXISTS(SELECT 1 FROM public.products WHERE shopify_variant_id=ANY(ARRAY[${rows.map(r=>`'${r.product.shopify_variant_id}'`).join(',')}]) OR sku=ANY(ARRAY['WINTER-M','ESP-6CUP','BEANIE-BLK']))
 OR EXISTS(SELECT 1 FROM (SELECT id FROM public.products UNION ALL SELECT id FROM public.zones UNION ALL SELECT id FROM public.locations UNION ALL SELECT id FROM public.inventory) x WHERE id=ANY(ARRAY[${ids.map(id=>`'${id}'::uuid`).join(',')}]))
 THEN RAISE EXCEPTION 'Existing/conflicting state; no upsert/reset'; END IF;
 SELECT count(*) INTO before_products FROM public.products;
 SELECT count(*) INTO before_locations FROM public.locations;
 SELECT count(*) INTO before_inventory FROM public.inventory;
 INSERT INTO public.zones(id,code,name,active,pick_priority) SELECT id,code,name,active,pick_priority FROM jsonb_populate_record(NULL::public.zones,${json(zone)});
 ${rows.map(r=>`INSERT INTO public.products(id,sku,product_name,variant_name,active,shopify_variant_id,shopify_product_id,shopify_quantity) SELECT id,sku,product_name,variant_name,active,shopify_variant_id,shopify_product_id,shopify_quantity FROM jsonb_populate_record(NULL::public.products,${json(r.product)});
 INSERT INTO public.locations(id,zone_id,code,active,pick_sequence,location_purpose) SELECT id,zone_id,code,active,pick_sequence,location_purpose FROM jsonb_populate_record(NULL::public.locations,${json(r.location)});
 INSERT INTO public.inventory(id,product_id,location_id,zone_id,quantity,is_primary) SELECT id,product_id,location_id,zone_id,quantity,is_primary FROM jsonb_populate_record(NULL::public.inventory,${json(r.inventory)});`).join('\n')}
 IF (SELECT count(*) FROM public.products)<>before_products+5 OR (SELECT count(*) FROM public.locations)<>before_locations+5 OR (SELECT count(*) FROM public.inventory)<>before_inventory+5 OR (SELECT sum(quantity) FROM public.inventory WHERE zone_id='${zone.id}')<>50 THEN RAISE EXCEPTION 'Fixture postcondition failed'; END IF;
END $seed$;
-- Reviewer must verify all 16 inserted rows before committing.
SELECT * FROM public.inventory WHERE zone_id='${zone.id}';
ROLLBACK; -- Deliberate review default. Replace only under separate seed approval.
`;
}
if(process.argv[2]==='--print-review-sql')process.stdout.write(seedSQL());
