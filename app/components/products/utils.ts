import type { ProductMeta, ProductRow } from "./types";

export function getMeta(product: ProductRow): ProductMeta {
  const inventory = product.inventory?.[0];

  const locationCode = inventory?.locations?.code ?? null;
  const locationZone = inventory?.locations?.zones ?? null;
  const directZone = inventory?.zones ?? null;

  const zone = locationZone || directZone;

  const status =
    locationCode
      ? "location"
      : zone
        ? "zone"
        : "missing";

  return {
    quantity: inventory?.quantity ?? 0,
    locationCode,
    zoneLabel: zone ? `${zone.code} — ${zone.name}` : null,
    zoneId: zone?.id ?? null,
    zoneCode: zone?.code ?? null,
    status,
  };
}