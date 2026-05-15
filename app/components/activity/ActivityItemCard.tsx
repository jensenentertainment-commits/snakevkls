import { Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  formatAction,
  formatRelativeTime,
  getActivityTone,
} from "./utils";

export type ActivityItem = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  actor_email: string | null;
  created_at: string;
};

function getMetadataLines(metadata: Record<string, unknown> | null) {
  if (!metadata) return [];

  const fromZone =
    typeof metadata.from_zone === "string" ? metadata.from_zone : null;
  const toZone =
    typeof metadata.to_zone === "string" ? metadata.to_zone : null;

  const fromLocation =
    typeof metadata.from_location === "string" ? metadata.from_location : null;
  const toLocation =
    typeof metadata.to_location === "string" ? metadata.to_location : null;

  const previousQuantity =
    typeof metadata.previous_quantity === "number"
      ? metadata.previous_quantity
      : null;

  const newQuantity =
    typeof metadata.new_quantity === "number"
      ? metadata.new_quantity
      : null;

  const lines: string[] = [];

  if (fromLocation !== toLocation && (fromLocation || toLocation)) {
    lines.push(
      `Lokasjon: ${fromLocation ?? "Ingen"} → ${toLocation ?? "Ingen"}`
    );
  }

  if (fromZone !== toZone && (fromZone || toZone)) {
    lines.push(`Sone: ${fromZone ?? "Ingen"} → ${toZone ?? "Ingen"}`);
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

  const tone = getActivityTone(item.action);
const metadataLines = getMetadataLines(item.metadata);

  return (
    <div className="px-5 py-5 transition hover:bg-[#055a7d]/[0.025] sm:px-6">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#055a7d]/15 bg-[#055a7d]/8 text-[#055a7d] sm:h-12 sm:w-12">
          <Activity className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
              {formatAction(item.action)}
            </span>

            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {item.entity_type}
            </span>
          </div>

          <h3 className="mt-2 text-base font-semibold leading-6 text-neutral-950">
            {item.title}
          </h3>

          {item.description && (
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              {item.description}
            </p>
          )}

    {metadataLines.length > 0 && (
  <div className="mt-2 space-y-1 rounded-xl bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-600">
    {metadataLines.map((line) => (
      <p key={line}>{line}</p>
    ))}
  </div>
)}

          <p className="mt-2 text-xs text-neutral-400">
            {formatRelativeTime(item.created_at)} ·{" "}
            {new Date(item.created_at).toLocaleString("nb-NO")}
          </p>

          {item.actor_email && (
            <p className="mt-1 text-xs text-neutral-500">
              Utført av {item.actor_email}
            </p>
          )}

          {showProductLink && productId && (
            <Link
              href={`/products/${productId}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#055a7d] underline-offset-4 hover:underline"
            >
              Åpne produkt
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}