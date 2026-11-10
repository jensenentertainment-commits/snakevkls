import test from 'node:test';
import assert from 'node:assert/strict';
import {searchLocations} from '../app/components/products/location-search.ts';
const rows=Array.from({length:617},(_,i)=>({id:String(i),code:`HL${String(i).padStart(3,'0')}-01-A`,zone_id:i%2?'a':'b',location_purpose:i%2?'PICK':'BUFFER'}));
test('location search retains all eligible rows, normalizes code and filters zone',()=>{
 assert.equal(searchLocations(rows,'','').length,617);
 assert.equal(searchLocations(rows,' hl616-01-a ','')[0].id,'616');
 assert.equal(searchLocations(rows,'HL61','').length,7);
 assert.equal(searchLocations(rows,'','a').length,308);
 assert.equal(searchLocations(rows,'HL616','a').length,0);
 assert.equal(searchLocations(rows,'invalid','').length,0);
 assert.equal(searchLocations([...rows,{id:'x',code:'X',zone_id:null}],'X','').length,0);
});
