// Standalone phase B. No Supabase, environment-file loading or Shopify mutations.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const SHOP = 'jensendigita.myshopify.com';
export const SHOP_ID = 'gid://shopify/Shop/76635341052';
export const SCOPES = ['read_orders', 'read_products'];
export function checkScopes(scopes) {
  const actual = [...new Set(scopes)].sort();
  if (JSON.stringify(actual) !== JSON.stringify(SCOPES)) throw new Error('Unexpected scopes');
}
export function checkConfig(c) {
  if (c?.shop !== SHOP || c?.shopId !== SHOP_ID ||
      !/^[a-f0-9]{32}$/i.test(c.clientId ?? '') ||
      typeof c.clientSecret !== 'string' || !c.clientSecret.trim() || c.clientSecret.trim() !== c.clientSecret)
    throw new Error('Invalid test configuration');
}
export function orderQuery() {
  const source = readFileSync(fileURLToPath(new URL('../../lib/viper/shopify/order-client.ts', import.meta.url)), 'utf8');
  const query = source.match(/const ORDER_PREVIEW_QUERY = `([^`]+)`;/)?.[1];
  if (!query || !query.includes('query ViperOrderPreview') || /\bmutation\b/.test(query)) throw new Error('Unknown Viper query');
  return query;
}
export async function run(c, request = fetch, report = console.log) {
  checkConfig(c);
  let token;
  let stage = 'authentication';
  async function json(path, body, authenticated = true) {
    const response = await request(`https://${SHOP}${path}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', ...(authenticated ? {'X-Shopify-Access-Token': token} : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.errors?.length) throw new Error('GraphQL rejected request');
    return data;
  }
  async function query(text, variables = {}) {
    if (/\bmutation\b/.test(text)) throw new Error('Mutations prohibited');
    return (await json('/admin/api/2026-04/graphql.json', {query:text, variables})).data;
  }
  try {
    const auth = await json('/admin/oauth/access_token', {
      grant_type:'client_credentials', client_id:c.clientId, client_secret:c.clientSecret,
    }, false);
    checkScopes(String(auth.scope ?? '').split(',').map(s=>s.trim()).filter(Boolean));
    if (typeof auth.access_token !== 'string' || !auth.access_token) throw new Error('Missing token');
    token = auth.access_token;
    stage = 'identity/scopes';
    const identity = await query('query ReadTestIdentity { shop { id myshopifyDomain } currentAppInstallation { accessScopes { handle } } }');
    if (identity?.shop?.id !== SHOP_ID || identity.shop.myshopifyDomain !== SHOP) throw new Error('Wrong shop');
    checkScopes(identity.currentAppInstallation.accessScopes.map(s=>s.handle));
    report(JSON.stringify({stage, status:'PASS', shop:SHOP, shopId:SHOP_ID, scopes:SCOPES}));
    stage = 'products';
    const products = await query('query ReadTestProducts { products(first: 2, sortKey: ID) { nodes { id title status variants(first: 5) { nodes { id sku } pageInfo { hasNextPage } } } pageInfo { hasNextPage } } }');
    // Only selected non-customer fields; no raw response/error/token logging.
    report(JSON.stringify({stage, status:'PASS', products:products.products}));
    stage = 'test-order discovery';
    const orders = await query('query ReadTestOrders { orders(first: 10, sortKey: CREATED_AT, reverse: true, query: "test:true status:open") { nodes { id test cancelledAt closed fulfillable displayFinancialStatus displayFulfillmentStatus } pageInfo { hasNextPage } } }');
    const candidate = orders.orders.nodes.find(o=>o.test === true && o.cancelledAt === null && o.closed === false && o.fulfillable === true && ['PAID','AUTHORIZED'].includes(o.displayFinancialStatus) && ['UNFULFILLED','PARTIALLY_FULFILLED'].includes(o.displayFulfillmentStatus));
    if (!candidate) { report(JSON.stringify({stage:'viper-order-query',status:'NOT TESTED',reason:'No eligible test order in bounded accessible sample'})); return; }
    stage = 'viper-order-query';
    // Recheck test flag immediately before executing the unchanged application query.
    const guard = await query('query ReadTestOrderGuard($id: ID!) { order(id:$id) { id test } }',{id:candidate.id});
    if (guard?.order?.id !== candidate.id || guard.order.test !== true) throw new Error('Not a test order');
    const data = await query(orderQuery(), {id:candidate.id});
    if (data?.order?.id !== candidate.id || !Array.isArray(data.order.lineItems?.nodes)) throw new Error('Invalid order response');
    report(JSON.stringify({stage,status:'PASS',orderId:candidate.id,lineCount:data.order.lineItems.nodes.length,hasNextPage:data.order.lineItems.pageInfo.hasNextPage,note:'Query verified; import/pick eligibility not certified'}));
  } catch {
    throw new Error(`Read test stopped at ${stage}; response/credentials withheld. No retry or fallback.`);
  } finally { token = undefined; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let input=''; for await (const chunk of process.stdin) { input+=chunk; if(input.length>10000) throw new Error('Oversized input'); }
    const config=JSON.parse(input); input='';
    await run(config);
  } catch (error) { console.error(error.message.startsWith('Read test stopped') ? error.message : 'Invalid local test configuration; stopped.'); process.exitCode=1; }
}
