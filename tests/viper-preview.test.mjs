import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PROJECT, URL, validateConfig, childEnvironment, previewProxy } from '../scripts/viper/preview.mjs';

const config = { project: PROJECT, url: URL, anonKey: 'sb_publishable_synthetic', serviceKey: 'sb_secret_synthetic' };
test('preview pins project and key roles before any network request', () => {
  assert.equal(validateConfig(config), config);
  for (const change of [{project:'production'}, {url:'https://other.supabase.co'}, {url:URL+'/redirect'}, {serviceKey:''}, {anonKey:config.serviceKey}]) {
    assert.throws(() => validateConfig({...config,...change}));
  }
  const jwt = role => 'eyJ.'+Buffer.from(JSON.stringify({ref:'other',role})).toString('base64url')+'.test';
  assert.throws(() => validateConfig({...config,serviceKey:jwt('service_role')}));
});
test('preview drops inherited credentials, injection and TLS overrides', () => {
  const env = childEnvironment({SystemRoot:'C:\\Windows',PATH:'safe',SHOPIFY_CLIENT_SECRET:'secret',OPENAI_API_KEY:'secret',PGPASSWORD:'secret',CRON_SECRET:'secret',NODE_OPTIONS:'--require unsafe',NODE_TLS_REJECT_UNAUTHORIZED:'0',HTTPS_PROXY:'unsafe',NEXT_PUBLIC_SUPABASE_URL:'production'},config);
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,URL);
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY,config.serviceKey);
  assert.equal(env.ROY_PHASE2A_ENABLED,'false');
  for(const key of ['SHOPIFY_CLIENT_SECRET','OPENAI_API_KEY','PGPASSWORD','CRON_SECRET','NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','HTTPS_PROXY']) assert.equal(env[key],undefined);
});
test('test copy is allowlisted; production root config and UI are not edited', () => {
  const source=readFileSync('scripts/viper/preview.mjs','utf8');
  assert.match(source,/mkdtempSync/);
  assert.match(source,/\['app', 'lib', 'types', 'public', 'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.mjs'\]/);
  assert.match(source,/redirect: 'error'/);
  assert.match(source,/--hostname', '127.0.0.1'/);
  assert.match(source,/No fallback to production/);
  assert.match(previewProxy,/status:403/);
  assert.doesNotMatch(previewProxy,/picks\|pick-lines\|admin\|shopify/);
  const seed=readFileSync('scripts/viper/preview-seed.sql','utf8');
  assert.match(seed,/7702071863184491885/);
  assert.match(seed,/Unexpected population/);
  assert.match(seed,/'manual','VUI-'/);
  assert.doesNotMatch(seed,/truncate|delete from|alter table|create table/i);
});
