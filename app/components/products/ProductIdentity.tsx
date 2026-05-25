type ProductIdentityProduct = {
  product_name: string;
  variant_name: string | null;
  image_url: string | null;
};

export default function ProductIdentity({
  product,
}: {
  product: ProductIdentityProduct;
}) {
  return (
    <div className="flex h-[64px] items-center gap-4 overflow-hidden">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            className="h-full w-full object-cover transition duration-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-300">
            —
          </div>
        )}
      </div>

      <div className="min-w-0 overflow-hidden">
        <p className="line-clamp-2 min-h-[40px] text-sm font-semibold leading-5 text-neutral-950">
          {product.product_name}
        </p>

        {product.variant_name && (
          <p className="mt-1 truncate text-[11px] font-medium tracking-[0.02em] text-neutral-400">
            {product.variant_name}
          </p>
        )}
      </div>
    </div>
  );
}