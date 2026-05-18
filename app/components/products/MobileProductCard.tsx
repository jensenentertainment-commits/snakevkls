import ProductIdentity from "./ProductIdentity";
import PlacementDisplay from "./PlacementDisplay";
import Status from "./Status";

type PlacementStatus = "location" | "zone" | "missing";

type ProductMeta = {
  quantity: number;
  locationCode: string | null;
  zoneLabel: string | null;
  zoneId: string | null;
  zoneCode: string | null;
  status: PlacementStatus;
};

type Product = {
  id: string;
  sku: string | null;
  product_name: string;
  variant_name: string | null;
  image_url: string | null;
  shopify_quantity: number;
};

export default function MobileProductCard({
  product,
  meta,
  selected,
  canWrite,
  onToggleSelected,
  onEdit,
}: {
  product: Product;
  meta: ProductMeta;
  selected: boolean;
  canWrite: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
}) {
  return (
    <article className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <ProductIdentity product={product} />

          <p className="mt-3 text-sm font-semibold text-neutral-950">
            {product.sku || <span className="text-red-600">Mangler SKU</span>}
          </p>
        </div>

        <Status status={meta.status} />
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-neutral-50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Plassering
          </p>

          <div className="mt-2">
            <PlacementDisplay meta={meta} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
          <span className="text-sm text-neutral-500">Antall</span>

          <div className="text-right">
            <p className="text-base font-semibold text-neutral-950">
              {meta.quantity}
            </p>

            <p className="text-xs text-neutral-400">
              Shopify: {product.shopify_quantity ?? 0}
            </p>
          </div>
        </div>
      </div>

      {canWrite && (
  <div className="mt-4 grid grid-cols-[auto_1fr] gap-3">
    <button
      onClick={onToggleSelected}
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
        selected
          ? "border-[#b58a14] bg-[#b58a14] text-white"
          : "border-neutral-300 bg-white text-neutral-700"
      }`}
    >
      {selected ? "Valgt" : "Velg"}
    </button>

    <button
      onClick={onEdit}
      className="rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white"
    >
      Endre plassering
    </button>
    </div>
      )}
    </article>
  );
}