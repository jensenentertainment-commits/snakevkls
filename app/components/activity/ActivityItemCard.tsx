import {
  Activity,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Package,
  RefreshCcw,
  Trash2,
  UserCog,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { formatAction, formatRelativeTime, getActivityTone } from "./utils";

export type ActivityItem = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  actor_email: string | null;
  actor_name: string | null;
  created_at: string;
};

function getMetadataLines(metadata: Record<string, unknown> | null) {
  if (!metadata) return [];

  const fromZone =
    typeof metadata.from_zone === "string" ? metadata.from_zone : null;
  const toZone = typeof metadata.to_zone === "string" ? metadata.to_zone : null;

  const fromLocation =
    typeof metadata.from_location === "string" ? metadata.from_location : null;
  const toLocation =
    typeof metadata.to_location === "string" ? metadata.to_location : null;

  const previousQuantity =
    typeof metadata.previous_quantity === "number"
      ? metadata.previous_quantity
      : typeof metadata.old_quantity === "number"
        ? metadata.old_quantity
        : null;

  const newQuantity =
    typeof metadata.new_quantity === "number" ? metadata.new_quantity : null;

  const locationCode =
    typeof metadata.location_code === "string" ? metadata.location_code : null;

  const zoneCode =
    typeof metadata.zone_code === "string" ? metadata.zone_code : null;

  const lines: string[] = [];

  if (fromLocation !== toLocation && (fromLocation || toLocation)) {
    lines.push(`Lokasjon: ${fromLocation ?? "Ingen"} → ${toLocation ?? "Ingen"}`);
  }

  if (fromZone !== toZone && (fromZone || toZone)) {
    lines.push(`Sone: ${fromZone ?? "Ingen"} → ${toZone ?? "Ingen"}`);
  }

  if (locationCode && !lines.some((line) => line.startsWith("Lokasjon:"))) {
    lines.push(`Lokasjon: ${locationCode}`);
  }

  if (zoneCode && !lines.some((line) => line.startsWith("Sone:"))) {
    lines.push(`Sone: ${zoneCode}`);
  }

  if (
    previousQuantity !== null &&
    newQuantity !== null &&
    previousQuantity !== newQuantity
  ) {
    lines.push(`Antall: ${previousQuantity} → ${newQuantity}`);
  }

  return lines;
}

function getActivityIcon(action: string) {
  if (action.includes("sync")) return RefreshCcw;
  if (action.includes("location")) return MapPin;
  if (action.includes("zone")) return MapPin;
  if (action.includes("quantity")) return Package;
  if (action.includes("removed")) return Trash2;
  if (action.includes("user") || action.includes("role")) return UserCog;
  if (action.includes("updated") || action.includes("set")) return Wrench;
  if (action.includes("completed")) return CheckCircle2;

  return Activity;
}

function getActivityShell(action: string) {
  if (action.includes("sync") || action.includes("completed")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (action.includes("removed")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (action.includes("quantity")) {
    return "border-[#b58a14]/25 bg-[#fff7e8] text-[#a77e04]";
  }

  if (action.includes("location") || action.includes("zone")) {
    return "border-[#055a7d]/15 bg-[#055a7d]/8 text-[#055a7d]";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

function getLocationHref(metadata: Record<string, unknown> | null) {
  const locationCode =
    typeof metadata?.location_code === "string" ? metadata.location_code : null;

  return locationCode ? `/locations/${encodeURIComponent(locationCode)}` : null;
}

export default function ActivityItemCard({
  item,
  showProductLink = true,
}: {
  item: ActivityItem;
  showProductLink?: boolean;
}) {
  const productId =
    typeof item.metadata?.product_id === "string"
      ? item.metadata.product_id
      : null;

  const locationHref = getLocationHref(item.metadata);
  const tone = getActivityTone(item.action);
  const Icon = getActivityIcon(item.action);
  const shell = getActivityShell(item.action);
  const metadataLines = getMetadataLines(item.metadata);
  const actor = item.actor_name || item.actor_email || "System";

  return (
    <article className="px-5 py-4 transition hover:bg-[#055a7d]/[0.025] sm:px-6">
      <div className="flex gap-4">
        <div
         className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${shell}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${tone}`}
            >
              {formatAction(item.action)}
            </span>

            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
              {item.entity_type}
            </span>

            <span className="text-xs text-neutral-400">
              {formatRelativeTime(item.created_at)}
            </span>
          </div>

          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold leading-6 text-neutral-950">
                {item.title}
              </h3>

              {item.description && (
                <p className="mt-1 text-sm leading-6 text-neutral-600">
                  {item.description}
                </p>
              )}
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs font-semibold text-neutral-500">
                {actor}
              </p>
       <p className="mt-0.5 text-xs text-neutral-400">
  {new Date(item.created_at).toLocaleString("nb-NO")}
</p>
            </div>
          </div>

          {metadataLines.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {metadataLines.map((line) => (
                <span
                  key={line}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600"
                >
                  {line}
                </span>
              ))}
            </div>
          )}

          {(showProductLink && productId) || locationHref ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {showProductLink && productId && (
                <Link
                  href={`/products/${productId}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#055a7d] underline-offset-4 hover:underline"
                >
                  Åpne produkt
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              {locationHref && (
                <Link
                  href={locationHref}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#055a7d] underline-offset-4 hover:underline"
                >
                  Åpne lokasjon
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}