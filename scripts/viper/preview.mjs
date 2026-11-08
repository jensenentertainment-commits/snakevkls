// Isolated UI preview. Never loads repository environment files.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import net from 'node:net';

export const PROJECT = 'mvwpbscexvnfavxhbexb';
export const URL = `https://${PROJECT}.supabase.co`;
export const TEST_EMAIL = 'viper-ui@example.test';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function validateConfig(config) {
  if (config?.project !== PROJECT || config?.url !== URL) throw new Error('Only the pinned snake-test project is allowed.');
  for (const name of ['anonKey', 'serviceKey']) {
    const key = config[name];
    if (typeof key !== 'string' || key.trim() !== key || !key) throw new Error(`Missing test ${name}.`);
    if (key.startsWith('eyJ')) {
      let payload;
      try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { throw new Error('Invalid test key format.'); }
      if (payload.ref !== PROJECT || payload.role !== (name === 'anonKey' ? 'anon' : 'service_role')) throw new Error('Key project/role mismatch.');
    } else if (!key.startsWith(name === 'anonKey' ? 'sb_publishable_' : 'sb_secret_')) {
      throw new Error('Unsupported test key type.');
    }
  }
  return config;
}

export function childEnvironment(host, config) {
  validateConfig(config);
  const env = {};
  // No inherited NODE_OPTIONS, proxies, TLS overrides, integration or DB secrets.
  const safe = new Set(['systemroot', 'windir', 'comspec', 'path', 'pathext', 'temp', 'tmp', 'userprofile', 'localappdata', 'appdata']);
  for (const [key, value] of Object.entries(host)) if (safe.has(key.toLowerCase())) env[key] = value;
  return Object.assign(env, {
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: config.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: config.serviceKey,
    VIPER_SHOPIFY_IMPORT_ENABLED: 'false', ROY_PHASE2A_ENABLED: 'false',
  });
}

async function request(config, path, admin = true, options = {}) {
  const key = admin ? config.serviceKey : config.anonKey;
  const response = await fetch(URL + path, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) throw new Error(`Test endpoint rejected request (${response.status}); response body withheld.`);
  return response.status === 204 ? null : response.json();
}

export async function verify(config) {
  validateConfig(config);
  await request(config, '/auth/v1/settings', false);
  await request(config, '/auth/v1/admin/users?page=1&per_page=1');
  await request(config, '/rest/v1/pick_jobs?select=id,version&limit=0');
  const connections = await request(config, '/rest/v1/shopify_connections?select=id&limit=1');
  if (connections.length) throw new Error('Test project has an external Shopify connection; preview refused.');
  console.log(`Verified HTTPS API host and both test keys: ${PROJECT}; version column present; no Shopify connection.`);
}

export const previewProxy = `import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from './lib/supabase/proxy';
export async function proxy(request: NextRequest) {
 const p=request.nextUrl.pathname;
 if(p.startsWith('/_next/') || p==='/favicon.ico' || /\\.(svg|png|jpg|jpeg|webp|ico)$/.test(p)) return NextResponse.next();
 if(p.startsWith('/api/')) {
  if(/^\\/api\\/viper\\/(picks|pick-lines|admin)(\\/|$)/.test(p)) return NextResponse.next();
  return new NextResponse('Isolert Viper-test: integrasjoner og andre API-er er sperret.',{status:403});
 }
 if(p==='/' || p==='/dashboard') return NextResponse.redirect(new URL('/viper',request.url));
 if(p!=='/login' && p!=='/viper' && !p.startsWith('/viper/')) return new NextResponse('Kun Viper er tilgjengelig i denne isolerte testkopien.',{status:403});
 return updateSession(request);
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
`;

export function createWorkspace(source, storage) {
  mkdirSync(storage, { recursive: true });
  if (lstatSync(storage).isSymbolicLink()) throw new Error('Preview storage must not be a link.');
  const workspace = mkdtempSync(join(storage, 'run-'));
  // Positive allowlist: no .env, .git, scripts, keys or prior build artifacts.
  for (const item of ['app', 'lib', 'types', 'public', 'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.mjs']) {
    const input = join(source, item);
    if (!existsSync(input)) throw new Error(`Missing source: ${item}`);
    cpSync(input, join(workspace, item), { recursive: true, filter: p => {
      if (lstatSync(p).isSymbolicLink()) throw new Error('Unexpected link in copied application sources.');
      return !/(^|[\\/])\.env[^\\/]*$/.test(p);
    } });
  }
  symlinkSync(join(source, 'node_modules'), join(workspace, 'node_modules'), 'junction');
  writeFileSync(join(workspace, 'next.config.mjs'), `export default { images: { unoptimized: true } };\n`);
  writeFileSync(join(workspace, 'proxy.ts'), previewProxy);
  const layoutPath = join(workspace, 'app/layout.tsx');
  let layout = readFileSync(layoutPath, 'utf8');
  if (!layout.includes('<AppRouteShell>{children}</AppRouteShell>') || !layout.includes('<AskBorre />')) throw new Error('Unknown layout; refuse to patch test copy.');
  layout = layout.replace('<AppRouteShell>{children}</AppRouteShell>', '<aside role="note" className="bg-snake-warning-surface p-3 text-center text-sm font-semibold text-snake-warning">SNAKE-TEST · Kun syntetiske Viper-data · Ingen produksjonsintegrasjoner</aside><AppRouteShell>{children}</AppRouteShell>')
    .replace('<AskBorre />', '').replace('import AskBorre from "./components/AskBorre";', '');
  writeFileSync(layoutPath, layout);
  return workspace;
}

async function assertPortFree() {
  await new Promise((ok, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error('Port 3000 is occupied. Stop the verified old Snake server first.')));
    server.listen(3000, '127.0.0.1', () => server.close(ok));
  });
}

async function main() {
  if (!['--verify', '--start', '--create-user'].includes(process.argv[2])) throw new Error('Use preview.ps1; explicit mode required.');
  let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 20000) throw new Error('Oversized configuration.'); }
  const config = validateConfig(JSON.parse(input)); input = '';
  await verify(config);
  if (process.argv[2] === '--verify') return;
  if (process.argv[2] === '--create-user') {
    if (typeof config.password !== 'string' || config.password.length < 16) throw new Error('A new test-only password of at least 16 characters is required.');
    const { users } = await request(config, '/auth/v1/admin/users?page=1&per_page=1');
    if (users.length) throw new Error('Auth is not empty. Refusing to create or replace users.');
    const user = await request(config, '/auth/v1/admin/users', true, { method: 'POST', body: JSON.stringify({email: TEST_EMAIL, password: config.password, email_confirm: true, user_metadata: { display_name: 'Viper UI-test' }}) });
    console.log(`Created test auth user ${user.id}. Profile and atomic fixture seed must be verified before preview use.`);
    return;
  }
  const profiles = await request(config, '/rest/v1/profiles?select=id&email=eq.viper-ui%40example.test&role=eq.admin&active=eq.true');
  if (profiles.length !== 1) throw new Error('Test administrator/profile is not prepared; no preview started.');
  const jobs = await request(config, '/rest/v1/orders?select=id&source=eq.manual&external_order_id=like.VUI-*');
  if (!jobs.length) throw new Error('UI fixtures not prepared; no preview started.');
  await assertPortFree();
  const workspace = createWorkspace(root, join(process.env.LOCALAPPDATA, 'SnakeViperPreview', 'workspaces'));
  console.log(`TEST ONLY: http://localhost:3000/login?next=/viper\nWorkspace: ${workspace}\nCtrl+C stops preview. Normal development files are unchanged.`);
  const child = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3000'], { cwd: workspace, env: childEnvironment(process.env, config), stdio: 'inherit', windowsHide: true });
  child.on('error', () => { console.error('Could not start isolated Next process.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Preview stopped. Missing/invalid test configuration, occupied port, or failed preflight. No fallback to production.'); process.exitCode = 1; });
}
