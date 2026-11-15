export type PlacementAction = "place" | "register" | "quantity";
type InventorySnapshot = {
  id: string; quantity: number; zone_id: string | null; location_id?: string | null;
  updated_at?: string; locations: { id: string } | null;
};

/** One shared client contract. A location-only request never carries a quantity. */
export function placementRequest(productId: string, inventory: InventorySnapshot | undefined,
  locationId: string, quantity: string, action: PlacementAction) {
  const base = { productId, inventoryId: inventory?.id ?? null, locationId, action,
    expectedLocationId: inventory?.location_id ?? inventory?.locations?.id ?? null,
    expectedZoneId: inventory?.zone_id ?? null };
  if (action === "place") return base;
  if (!quantity.trim() || !Number.isSafeInteger(Number(quantity)) || Number(quantity) < 0 || Number(quantity) > 2147483647) {
    throw new Error("Antall må være et heltall fra 0 til 2 147 483 647");
  }
  return { ...base, quantity: Number(quantity), ...(action === "quantity" ? {
    expectedQuantity: inventory?.quantity, expectedUpdatedAt: inventory?.updated_at,
  } : {}) };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 2147483647;
const nullableId = (v: unknown) => v === null || (typeof v === "string" && uuid.test(v));

export function parsePlacement(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Ugyldig forespørsel");
  const b = body as Record<string, unknown>;
  if (typeof b.productId !== "string" || !uuid.test(b.productId) || typeof b.locationId !== "string" || !uuid.test(b.locationId)) throw new Error("Velg produkt og konkret lokasjon");
  if (!["place", "register", "quantity"].includes(String(b.action))) throw new Error("Velg en gyldig handling");
  if (!nullableId(b.inventoryId) || !nullableId(b.expectedLocationId) || !nullableId(b.expectedZoneId)) throw new Error("Ugyldig lagerpost eller førverdi");
  if (b.action === "register" ? b.inventoryId !== null : b.inventoryId === null) throw new Error("Ugyldig lagerpost");
  if (b.action === "place" && ("quantity" in b || "expectedQuantity" in b || "expectedUpdatedAt" in b)) throw new Error("Ren plassering skal ikke sende antall");
  if (b.action !== "place" && !integer(b.quantity)) throw new Error("Antall må være et heltall fra 0 til 2 147 483 647");
  if (b.action === "quantity" && (!integer(b.expectedQuantity) || typeof b.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(b.expectedUpdatedAt)))) throw new Error("Lagergrunnlaget mangler. Last siden på nytt.");
  return {
    requested_action: b.action, requested_product_id: b.productId, requested_inventory_id: b.inventoryId,
    requested_location_id: b.locationId, expected_location_id: b.expectedLocationId, expected_zone_id: b.expectedZoneId,
    requested_quantity: b.action === "place" ? null : b.quantity,
    expected_quantity: b.action === "quantity" ? b.expectedQuantity : null,
    expected_updated_at: b.action === "quantity" ? b.expectedUpdatedAt : null,
  };
}
