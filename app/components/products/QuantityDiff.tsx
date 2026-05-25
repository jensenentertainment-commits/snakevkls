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
      <span className="text-sm font-semibold text-neutral-950">
        Lager {snakeQuantity}
      </span>

      <span className="mt-0.5 text-xs text-neutral-400">
        Shopify {shopifyQuantity}
      </span>

      {diff !== 0 && (
        <span
          className={`mt-2 inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            diff > 0
              ? "border-[#a77e05]/20 bg-[#a77e05]/10 text-[#8a6704]"
              : "border-[#b45454]/20 bg-[#b45454]/10 text-[#9f3f3f]"
          }`}
        >
          {diff > 0
            ? `${diff} ikke plassert`
            : `${Math.abs(diff)} for mye i Snake`}
        </span>
      )}
    </div>
  );
}