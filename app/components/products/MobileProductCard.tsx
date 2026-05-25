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
  <article
    className={`px-5 py-5 transition ${
      selected
        ? "bg-[#fbf6e8]/55 shadow-[inset_4px_0_0_rgba(181,138,20,0.72)]"
        : meta.status === "missing"
          ? "bg-[#fbf6e8]/30"
          : "bg-white"
    }`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <ProductIdentity product={product} />

        <p className="mt-3 text-sm font-semibold text-neutral-950">
          {product.sku || <span className="text-red-600">Mangler SKU</span>}
        </p>
      </div>

      <Status status={meta.status} />
    </div>

    <div className="mt-4 grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          Plassering
        </p>

        <div className="mt-2">
          <PlacementDisplay meta={meta} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
        <span className="text-sm font-medium text-neutral-500">Antall</span>

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
      <div className="mt-4 grid grid-cols-[92px_1fr] gap-3">
        <button
          onClick={onToggleSelected}
          className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
            selected
              ? "border-[#b58a14]/60 bg-[#b58a14] text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:border-[#055a7d]/25 hover:text-[#055a7d]"
          }`}
        >
          {selected ? "Valgt" : "Velg"}
        </button>

        <button
          onClick={onEdit}
          className="rounded-xl bg-[#055a7d] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#044c6a]"
        >
          Endre plassering
        </button>
      </div>
    )}
  </article>
);
}