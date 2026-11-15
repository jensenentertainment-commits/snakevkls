export type IssueInventory = { id: string; product_id: string; quantity: number; location_id: string | null; zone_id: string | null };
export type IssueProduct = { id: string; sku: string | null; product_name: string; variant_name: string | null };
export type IssueLocation = { id: string; code: string; active: boolean; zone_id: string | null; zones: { id: string; code: string } | null };
export type IssueItem = { id: string; severity: "critical" | "warning" | "info"; type: string; title: string; description: string; meta?: string; href: string; action: string };

/** Registration observations only: no inference about physical stock or SKU quality. */
export function inventoryIssues(products: IssueProduct[], inventory: IssueInventory[], locations: IssueLocation[]) {
  const byProduct = new Map(products.map(p => [p.id, p]));
  const byLocation = new Map(locations.map(l => [l.id, l]));
  const list: IssueItem[] = [];
  for (const row of inventory) {
    if (row.quantity <= 0) continue;
    const product = byProduct.get(row.product_id);
    const location = row.location_id ? byLocation.get(row.location_id) : undefined;
    const base = { id: `inventory-${row.id}`, severity: "warning" as const,
      title: product?.product_name ?? "Produktopplysninger utilgjengelige",
      description: `${row.quantity} registrerte enheter. Dette er et registreringsforhold, ikke en bekreftet fysisk lagerfeil.`,
      meta: [product?.sku, product?.variant_name, location?.code, location?.zones?.code].filter(Boolean).join(" · "),
      href: `/products/${row.product_id}`, action: "Kontroller plassering" };
    if (!location || !location.zone_id || !location.zones) {
      list.push({ ...base, type: "Positiv beholdning uten gyldig lokasjon" });
    } else if (!location.active) {
      list.push({ ...base, type: "Positiv beholdning på inaktiv lokasjon" });
    } else if (row.zone_id !== location.zone_id) {
      list.push({ ...base, type: "Sone stemmer ikke med lokasjonen" });
    }
  }
  for (const location of locations) {
    if (location.active && (!location.zone_id || !location.zones)) list.push({
      id: `location-${location.id}`, severity: "warning", type: "Aktiv lokasjon uten gyldig sone",
      title: location.code, description: "Lokasjonen mangler gyldig sonetilknytning.", href: "/locations", action: "Kontroller lokasjon",
    });
  }
  return { list, productCount: list.filter(i => i.id.startsWith("inventory-")).length,
    locationCount: list.filter(i => i.id.startsWith("location-")).length };
}

export async function readAllIssuePages<T>(readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 500) {
    const page = await readPage(from, from + 499);
    if (page.error || !page.data) throw new Error("Kunne ikke hente komplett avviksgrunnlag. Prøv igjen.");
    result.push(...page.data);
    if (page.data.length < 500) return result;
  }
}
