import { ZONE_STYLES } from "./constants";

type ProductMeta = {
  locationCode: string | null;
  zoneLabel: string | null;
  zoneCode: string | null;
};

export default function PlacementDisplay({ meta }: { meta: ProductMeta }) {
  if (meta.locationCode) {
    return (
      <span className="rounded-lg border border-[#055a7d]/20 bg-[#055a7d]/5 px-2 py-1 text-xs font-semibold text-[#055a7d]">
        {meta.locationCode}
      </span>
    );
  }

  if (meta.zoneLabel) {
    const zoneStyle =
      meta.zoneCode && ZONE_STYLES[meta.zoneCode]
        ? ZONE_STYLES[meta.zoneCode]
        : "border-[#a77e05]/20 bg-[#a77e05]/10 text-[#a77e05]";

    return (
      <span
        className={`rounded-lg border px-2 py-1 text-xs font-semibold ${zoneStyle}`}
      >
        {meta.zoneLabel}
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap font-semibold text-red-600">
      Mangler plassering
    </span>
  );
}