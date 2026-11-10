import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkspaceOverview } from './workspace-overview.ts';
import type { StockData } from './stock-contract.ts';

const data = (quantities: number[]): StockData => ({products: [], locations: [], zones: [], inventory: quantities.map((quantity, i) => ({id: String(i),product_id:'same-product',location_id:null,zone_id:null,quantity}))});
test('overview sums rows once including multiple rows for one product; zero is not an issue', () => {
  assert.deepEqual(buildWorkspaceOverview(data([3,5,0])), {registeredQuantity:8,invalidPlacementRows:2});
  assert.deepEqual(buildWorkspaceOverview(data([0,0])), {registeredQuantity:0,invalidPlacementRows:0});
});
test('invalid and overflowing quantities are unknown, not a reassuring zero', () => {
  for(const values of [[-1,5],[0.5],[Number.MAX_SAFE_INTEGER,1]]) assert.deepEqual(buildWorkspaceOverview(data(values)), {registeredQuantity:null,invalidPlacementRows:null});
});
test('valid PICK and BUFFER placements do not become findings', () => {
  const fixture=data([3,5]);
  fixture.zones=[{id:'z',code:'HL',name:'Test',active:true}];
  fixture.locations=['PICK','BUFFER'].map((location_purpose,i)=>({id:String(i),code:`TEST${i}`,zone_id:'z',active:true,location_purpose}));
  fixture.inventory.forEach((row,i)=>{row.location_id=String(i);row.zone_id='z';});
  const before=structuredClone(fixture);
  assert.deepEqual(buildWorkspaceOverview(fixture),{registeredQuantity:8,invalidPlacementRows:0});
  assert.deepEqual(fixture,before);
});
