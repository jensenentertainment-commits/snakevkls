import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration } from '../scripts/viper/database-acceptance.mjs';
test('Viper database runner defaults offline and rejects implicit or remote targets',()=>{
 assert.equal(configuration([],{}),null);
 assert.equal(configuration(['--plan'],{}),null);
 assert.throws(()=>configuration(['--execute','vk-lager','EXECUTE ISOLATED VIPER vk-lager'],{}));
 assert.throws(()=>configuration(['--execute','snake_viper_test_step1','EXECUTE ISOLATED VIPER snake_viper_test_step1'],{PGHOST:'db.example.com'}));
 assert.throws(()=>configuration(['--execute','snake_viper_test_step1','EXECUTE ISOLATED VIPER snake_viper_test_step1'],{PGHOST:'127.0.0.1',PGSERVICE:'production'}));
});
