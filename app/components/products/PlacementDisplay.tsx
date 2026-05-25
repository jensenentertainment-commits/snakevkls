import { ZONE_STYLES } from "./constants";

type ProductMeta = {
  locationCode: string | null;
  zoneLabel: string | null;
  zoneCode: string | null;
};

export default function PlacementDisplay({ meta }: { meta: ProductMeta }) {
  if (meta.locationCode) {
    return (
      <span className="inline-flex items-center rounded-xl border border-[#055a7d]/20 bg-[#055a7d]/8 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-[#055a7d] shadow-sm">
        {meta.locationCode}
      </span>
    );
  }

  if (meta.zoneLabel) {
    const zoneStyle =
      meta.zoneCode && ZONE_STYLES[meta.zoneCode]
        ? ZONE_STYLES[meta.zoneCode]
        : "border-[#a77e05]/20 bg-[#a77e05]/10 text-[#8a6704]";

    return (
      <span
        className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] shadow-sm ${zoneStyle}`}
      >
        {meta.zoneLabel}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-xl border border-[#b45454]/20 bg-[#b45454]/8 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-[#9f3f3f]">
      Mangler plassering
    </span>
  );
}