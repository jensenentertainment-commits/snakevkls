import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function route(path, authorized = true) {
  const calls = [];
  const context = {
    exports: {}, console: { error() {} },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } };
      if (name.includes('require-role')) return { requireRole: async roles => {
        assert.deepEqual(Array.from(roles), ['admin', 'user', 'warehouse']);
        return authorized ? { ok: true, user: { id: 'actor' }, profile: {} } : { ok: false, response: { status: 403 } };
      } };
      if (name.includes('/admin')) return { getSupabaseAdmin: () => ({ rpc: async (name, args) => {
        calls.push({ name, args }); return { data: {}, error: null };
      } }) };
      throw Error(name);
    },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { post: body => context.exports.POST({ json: async () => body }), calls };
}
const path = 'app/api/inventory/set-location/route.ts';
test('placement rejects absent location even when a zone was supplied', async () => {
  const r = route(path);
  for (const locationId of [null, undefined, '']) {
    assert.equal((await r.post({ productId: 'product', zoneId: 'zone', locationId, quantity: 10 })).status, 400);
  }
  assert.equal(r.calls.length, 0);
});
test('placement delegates zone to authoritative RPC, preserving inventory identity and quantity', async () => {
  const r = route(path);
  assert.equal((await r.post({ productId: 'product', inventoryId: 'existing', zoneId: 'wrong-zone', locationId: 'location', quantity: 10 })).status, 200);
  assert.equal(r.calls.length, 1);
  const { name, args } = r.calls[0];
  assert.equal(name, 'set_product_location');
  assert.equal(args.requested_zone_id, null);
  assert.equal(args.requested_location_id, 'location');
  assert.equal(args.requested_inventory_id, 'existing');
  assert.equal(args.requested_quantity, 10);
});
test('placement retains quantity and role validation', async () => {
  const r = route(path);
  for (const quantity of [-1, 1.5, 'bad']) assert.equal((await r.post({ productId: 'p', locationId: 'l', quantity })).status, 400);
  const denied = route(path, false);
  assert.equal((await denied.post({ productId: 'p', locationId: 'l', quantity: 1 })).status, 403);
  assert.equal(r.calls.length + denied.calls.length, 0);
});
test('retired zone batch endpoint never calls database and retains authorization', async () => {
  const p = 'app/api/inventory/batch-zone/route.ts';
  const r = route(p);
  assert.equal((await r.post({ productIds: ['p'], zoneId: 'z' })).status, 410);
  assert.equal(r.calls.length, 0);
  assert.equal((await route(p, false).post({})).status, 403);
});
test('both product pages use location dialog; no zone-only write controls remain', () => {
  const modal = readFileSync('app/components/products/EditPlacementModal.tsx', 'utf8');
  assert.match(modal, /<LocationPicker/);
  assert.match(modal, /value=\{newLocation\}/);
  assert.doesNotMatch(modal, /setNewZone|Ingen eksakt lokasjon/);
  for (const p of ['app/products/page.tsx', 'app/products/[id]/page.tsx']) {
    const s = readFileSync(p, 'utf8');
    assert.match(s, /<EditPlacementModal/);
    assert.doesNotMatch(s, /BatchAssignModal|setInlineZone|setNewZone/);
  }
  const sql = readFileSync('supabase/migrations/20260721172143_phase_3_inventory_integrity.sql', 'utf8');
  assert.match(sql, /select location.zone_id, location.code\s+into effective_zone_id, location_code/);
  assert.match(sql, /location.id = requested_location_id and location.active = true/);
});

test('opening placement selects product and initializes existing or empty inventory', () => {
  const source = readFileSync('app/products/page.tsx', 'utf8');
  const fn = source.slice(source.indexOf('function openModal('), source.indexOf('const { collections, filtered }'));
  let editing, location, quantity;
  const ctx = { setEditing: v => editing = v, setNewLocation: v => location = v, setNewQuantity: v => quantity = v };
  vm.runInNewContext(ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  const product = { id: 'p', inventory: [{ quantity: 7, locations: { id: 'l' } }] };
  ctx.openModal(product);
  assert.equal(editing, product); assert.equal(location, 'l'); assert.equal(quantity, '7');
  ctx.openModal({ id: 'new', inventory: [] });
  assert.equal(editing.id, 'new'); assert.equal(location, ''); assert.equal(quantity, '0');
});
