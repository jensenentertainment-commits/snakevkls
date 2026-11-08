// Declarative fixture only. Importing this module performs no I/O.
export const PROJECT = 'mvwpbscexvnfavxhbexb';
export const SYSTEM_ID = '7702071863184491885';
export const SHOP = 'jensendigita.myshopify.com';
export const SHOP_ID = 'gid://shopify/Shop/76635341052';
export const ORDER_ID = 'gid://shopify/Order/18982115672316';
export const zone = {id:'a2000000-0000-4000-8000-000000000001',code:'VE2E',name:'Viper E2E testlager – ordre #1001',active:true,pick_priority:201};
const variants = ['48590430667004','48590431944956','48590427455740','48590426013948','48590426046716'];
const skus = ['WINTER-M',null,'ESP-6CUP','BEANIE-BLK',null];
const lines = ['50886527451388','50886527484156','50886527516924','50886527549692','50886527582460'];
export const rows = variants.map((id,i)=>{
  const suffix=String(i+1).padStart(12,'0');
  const productId=`a4000000-0000-4000-8000-${suffix}`;
  const locationId=`a3000000-0000-4000-8000-${suffix}`;
  return {
    externalLineId:`gid://shopify/LineItem/${lines[i]}`,
    product:{id:productId,sku:skus[i],product_name:`Viper E2E #1001 – testvare ${i+1}`,variant_name:null,active:true,shopify_variant_id:`gid://shopify/ProductVariant/${id}`,shopify_product_id:null,shopify_quantity:null},
    location:{id:locationId,zone_id:zone.id,code:`VE2E0${i+1}`,active:true,pick_sequence:i+1,location_purpose:'PICK'},
    inventory:{id:`a5000000-0000-4000-8000-${suffix}`,product_id:productId,location_id:locationId,zone_id:zone.id,quantity:10,is_primary:true},
    expectedQuantity:9,
  };
});

export function assertOrder(order) {
  if(order?.id!==ORDER_ID || order.name!=='#1001' || order.cancelledAt!==null || order.closed!==false || order.fulfillable!==true || order.displayFinancialStatus!=='PAID' || order.displayFulfillmentStatus!=='UNFULFILLED' || order.lineItems?.pageInfo?.hasNextPage!==false || order.lineItems.nodes.length!==5) throw new Error('Order differs from approved manifest');
  const ids=new Set();
  for(const row of rows) {
    const line=order.lineItems.nodes.find(l=>l.id===row.externalLineId);
    if(!line || line.variant?.id!==row.product.shopify_variant_id || (line.variant.sku??line.sku??null)!==row.product.sku || line.unfulfilledQuantity!==1 || line.requiresShipping!==true || ids.has(line.id)) throw new Error('Line differs from approved manifest');
    ids.add(line.id);
  }
}
