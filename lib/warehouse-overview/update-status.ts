import { formatRoyTime } from "../intelligence/roy/format-time.ts";
import type { WarehouseOverviewData } from "./model.ts";

/** Read times describe source retrieval, never the time of the underlying event. */
export function overviewUpdateStatus(data: WarehouseOverviewData) {
  const sources = [
    ["Avvik", data.issues], ["Tellinger", data.counts],
    ["Viper", data.picks], ["Lageraktivitet", data.activity],
  ] as const;
  const entries = sources.map(([label, result]) => ({
    label,
    time: result.ok && Number.isFinite(Date.parse(result.readAt)) ? formatRoyTime(result.readAt) : null,
    ok: result.ok,
  }));
  const successful = entries.filter(entry => entry.ok);
  const commonTime = successful[0]?.time;
  const uniform = successful.length === entries.length && commonTime !== null &&
    entries.every(entry => entry.time === commonTime);
  const summary = uniform ? `Oppdatert ${commonTime}`
    : successful.length === 0 ? "Ingen datakilder kunne hentes"
    : successful.length < entries.length ? `Delvis oppdatert · ${successful.length} av ${entries.length} datakilder`
    : "Data hentet på ulike eller ukjente tidspunkt";
  return { summary, showDetails: !uniform, entries };
}
