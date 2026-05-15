export function formatAction(action: string) {
  const labels: Record<string, string> = {
    zone_set: "Sone satt",
    batch_zone_set: "Batch sone",
    location_set: "Lokasjon satt",
    manual_stock_movement: "Uttak / korrigering",
    product_added_to_location: "Produkt lagt til",
    quantity_updated: "Antall endret",
    removed_from_location: "Fjernet fra lokasjon",
    shopify_sync_completed: "Shopify sync fullført",
    shopify_sync_failed: "Shopify sync feilet",
    shopify_sync_started: "Shopify sync startet",
    location_created: "Lokasjon opprettet",
    location_updated: "Lokasjon endret",
    location_activated: "Lokasjon aktivert",
    location_deactivated: "Lokasjon deaktivert",
  };

  return labels[action] ?? action;
}

export function getActivityTone(action: string) {
  const tones: Record<string, string> = {
    manual_stock_movement:
      "border-red-200 bg-red-50 text-red-700",

    removed_from_location:
      "border-red-200 bg-red-50 text-red-700",

    zone_set:
      "border-amber-200 bg-amber-50 text-amber-700",

    batch_zone_set:
      "border-purple-200 bg-purple-50 text-purple-700",

    location_set:
      "border-blue-200 bg-blue-50 text-blue-700",

    product_added_to_location:
      "border-green-200 bg-green-50 text-green-700",

    quantity_updated:
      "border-neutral-300 bg-neutral-100 text-neutral-700",

    shopify_sync_completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700",

    shopify_sync_started:
      "border-blue-200 bg-blue-50 text-blue-700",

    shopify_sync_failed:
      "border-red-200 bg-red-50 text-red-700",

    location_created:
      "border-green-200 bg-green-50 text-green-700",

    location_updated:
      "border-blue-200 bg-blue-50 text-blue-700",

    location_activated:
      "border-emerald-200 bg-emerald-50 text-emerald-700",

    location_deactivated:
      "border-neutral-300 bg-neutral-100 text-neutral-700",
  };

  return (
    tones[action] ??
    "border-neutral-200 bg-neutral-100 text-neutral-600"
  );
}

export function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / 1000 / 60);

  if (minutes < 1) return "Nå nettopp";
  if (minutes < 60) return `${minutes} min siden`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} t siden`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days} d siden`;

  return date.toLocaleDateString("nb-NO");
}