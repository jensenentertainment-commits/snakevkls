type ProductMeta = {
  quantity: number;
};

type Product = {
  shopify_quantity: number;
};

export default function QuantityDiff({
  product,
  meta,
}: {
  product: Product;
  meta: ProductMeta;
}) {
  const shopifyQuantity = product.shopify_quantity ?? 0;
  const snakeQuantity = meta.quantity ?? 0;
  const diff = shopifyQuantity - snakeQuantity;

  return (
    <div className="flex min-h-[58px] flex-col justify-center">
      <span className="font-semibold text-neutral-950">
        Lager: {snakeQuantity}
      </span>

      <span className="text-xs text-neutral-400">
        Shopify: {shopifyQuantity}
      </span>

      {diff > 0 && (
        <span className="mt-1 whitespace-nowrap text-xs font-semibold text-[#a77e05]">
          {diff} ikke plassert
        </span>
      )}

      {diff < 0 && (
        <span className="mt-1 whitespace-nowrap text-xs font-semibold text-red-600">
          {Math.abs(diff)} for mye i Snake
        </span>
      )}
    </div>
  );
}