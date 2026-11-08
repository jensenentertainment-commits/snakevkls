import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const catalog=read('supabase/migrations/20261108170000_sku_independent_catalog_identity.sql');
const viper=read('supabase/migrations/20261108170100_viper_optional_sku_compatibility.sql');
test('three approved Viper migrations remain byte-equivalent after newline normalization',()=>{
  const hashes={
    '20261103215816_viper_shared_location_validation.sql':'0d457477a7aae83c0a8a9829c0e11fc246110a4ec6ee5fc6851dddce980a9e13',
    '20261104062000_viper_fenced_pick_commands.sql':'b140065898be473370ec85fb97220846db055782510427c12be008f03008998e',
    '20261104201000_viper_fresh_start_completion.sql':'b3b08a0d15273b38ddb7d8a360f67f5a3aa0aea7bc403bfe1a61f308834e4eac',
  };
  for(const [file,hash] of Object.entries(hashes))assert.equal(createHash('sha256').update(read('supabase/migrations/'+file)).digest('hex'),hash);
});
function fn(s,name) {
  const start=s.search(new RegExp('create (?:or replace )?function '+name.replaceAll('.','\\.')+'\\('));
  assert.ok(start>=0,name);
  return s.slice(start,s.indexOf('$$;',s.indexOf('as $$',start))+3).replace(/^create function/,'create or replace function');
}
test('identity writer retains legacy persistence, locks exact variant and removes SKU matching/skipping/coalesce',()=>{
  const original=fn(read('supabase/migrations/20260729190854_warehouse_sales_phase_1_shopify_catalog.sql'),'public.apply_shopify_sync_page');
  const expected=original.replace('function public.','function private.')
    .replace(/    if local_product_id is null and variant_sku is not null then[\s\S]*?    if local_product_id is null then/,
      '    -- Variant ID alone is identity. Null/duplicate SKU never changes matching.\n\n    if local_product_id is null then')
    .replace('where shopify_variant_id = variant_id;','where shopify_variant_id = variant_id\n    for update;')
    .replace('set sku = coalesce(variant_sku, sku),','set sku = variant_sku,');
  assert.equal(fn(catalog,'private.apply_shopify_sync_page'),expected);
  assert.match(catalog,/drop constraint products_sku_key/);
  assert.match(catalog,/drop index public.products_sku_unique/);
  assert.match(catalog,/create index if not exists idx_products_sku on public.products\(sku\)/);
  assert.doesNotMatch(catalog,/drop.*shopify_variant|update public.inventory|delete from public.products|update public.stock_movements/i);
});
test('completion freezes active dependencies without blocking lock waits or partial reconciliation',()=>{
  const complete=fn(catalog,'private.complete_shopify_sync_run');
  assert.ok(complete.indexOf('for update')<complete.indexOf('private.lock_catalog_reconciliation_v1()'));
  assert.ok(complete.indexOf('SHOPIFY_DEACTIVATION_BLOCKED')<complete.indexOf('update public.products'));
  assert.ok(complete.indexOf('update public.products')<complete.indexOf("status = 'completed'"));
  assert.match(catalog,/in exclusive mode nowait/);
  assert.match(catalog,/transaction_isolation.*read committed/);
  for(const table of ['pick_jobs','orders','order_lines','pick_lines','pick_exceptions','products','inventory','warehouse_sale_lines','warehouse_sale_shopify_sync_jobs'])
    assert.ok(fn(catalog,'private.lock_catalog_reconciliation_v1').includes('public.'+table));
  for(const code of ['physical_stock','active_order','active_pick','open_pick_exception','unfinished_sale_sync'])assert.ok(catalog.includes(code));
  assert.match(catalog,/i.quantity>0/);
  assert.match(catalog,/o.status in \('received','ready_to_pick','picking'\)/);
  assert.match(catalog,/j.status in \('ready','in_progress'\)/);
  assert.match(catalog,/j.status in \('pending','processing','failed'\)/);
  assert.doesNotMatch(fn(catalog,'private.catalog_deactivation_blockers_v1'),/stock_movements|activity_log/);
});
test('protected completion retains operation then run ordering before the same barrier',()=>{
  const complete=fn(catalog,'public.complete_shopify_backfill_v1');
  assert.ok(complete.indexOf('for update')<complete.indexOf('private.claim_shopify_sync_run'));
  assert.ok(complete.indexOf('private.claim_shopify_sync_run')<complete.indexOf('private.lock_catalog_reconciliation_v1'));
  assert.ok(complete.indexOf('private.lock_catalog_reconciliation_v1')<complete.indexOf('preview:=public.preview_shopify_backfill_v1'));
  assert.ok(complete.indexOf('private.complete_shopify_sync_run')<complete.indexOf('set completed_at='));
  const apply=fn(catalog,'public.apply_shopify_backfill_page_v1');
  assert.doesNotMatch(apply,/where sku=|prior.sku|\x27skipped\x27,true/);
  assert.match(apply,/where shopify_variant_id=source->>'shopifyVariantId'/);
  assert.match(apply,/id=\(evidence->>'priorId'\)::uuid/);
});
test('proof samples exclude ambiguous SKU but exact aggregates/receipts retain SKU-less variants',()=>{
  const proof=fn(catalog,'public.get_shopify_backfill_proof_facts_v1');
  assert.equal((proof.match(/duplicate.sku=/g)||[]).length,2);
  assert.match(proof,/latest_variants[\s\S]*value->>'variantId'/);
  const provider=read('lib/intelligence/workforce/contexts/shopify-catalog-provider.ts');
  assert.match(provider,/uniqueCatalogSkuMatch\(rows, intent.sku\)/);
  assert.match(provider,/rows.length > 1[\s\S]*unresolved_reference/);
  assert.doesNotMatch(provider,/rows\[0\].shopify_product_id/);
});
test('Viper forward migration changes only cross-catalog SKU equality',()=>{
  const original=fn(read('supabase/migrations/20261103215816_viper_shared_location_validation.sql'),'public.validate_viper_order_lines');
  assert.equal(fn(viper,'public.validate_viper_order_lines'), original.replace(/    if line_sku is not null and product_row.sku is not null[\s\S]*?    end if;\n/,
    '    -- SKU is descriptive; the exact Shopify variant resolved above is identity.\n'));
  const command=fn(read('supabase/migrations/20261104201000_viper_fresh_start_completion.sql'),'public.apply_viper_pick_command');
  assert.equal(fn(viper,'public.apply_viper_pick_command'),command.replace(/     or \(line.sku is not null[^\n]+\n/,''));
  assert.match(viper,/line.current_variant is distinct from line.shopify_variant_id/);
  assert.match(viper,/actual_lines is distinct from supplied_lines/);
  assert.match(viper,/get_viper_pick_command_result/);
});
test('prepared fixtures cover rollback, concurrency and normal UUID-based Viper/sales',()=>{
  for(const name of ['catalog-identity.dynamic','catalog-viper-sales.dynamic','catalog-concurrency-setup','catalog-concurrency-writer','catalog-concurrency-completion','catalog-concurrency-cleanup'])
    assert.ok(read('tests/database/'+name+'.sql').startsWith('\\ir roy-phase-2a-acceptance.guard.sql'));
  const concurrent=read('tests/database/catalog-concurrency-completion.sql');
  const setup=read('tests/database/catalog-concurrency-setup.sql');
  assert.ok(setup.includes("public.claim_shopify_sync_run('manual',null,300)"));
  assert.ok(setup.includes("null,'final',false,'[]',300)"));
  assert.doesNotMatch(setup,/3600/);
  assert.match(setup,/loop\s+--[^\n]+\s+perform pg_stat_clear_snapshot\(\);\s+if exists/);
  assert.match(concurrent,/exception when lock_not_available/);
  assert.match(concurrent,/phase2a_test.snapshot\(\)=before_state/);
  assert.match(concurrent,/wait_catalog_barrier\(1,false\)/);
  const writer=read('tests/database/catalog-concurrency-writer.sql');
  for(const name of ['inventory','inventory_insert','order','order_insert','pick','product_share'])assert.ok(writer.includes("when '"+name+"'"));
  const flow=read('tests/database/catalog-viper-sales.dynamic.sql');
  assert.match(flow,/shopify_inventory_item_id,shopify_inventory_level_id,shopify_price_minor/);
  assert.match(flow,/'gid:\/\/shopify\/InventoryItem\/98701','gid:\/\/shopify\/InventoryLevel\/98701\?inventory_item_id=98701'/);
  assert.match(read('supabase/migrations/20260801185133_warehouse_sales_cash_payment.sql'),/or product.shopify_inventory_level_id is null/);
  assert.match(flow,/materialize_viper_shopify_order/);assert.match(flow,/complete_warehouse_sale/);
  assert.match(flow,/No second stock deduction/);
  assert.match(read('scripts/roy-phase2a/database-acceptance.mjs'),/catalog-identity.dynamic/);
});
