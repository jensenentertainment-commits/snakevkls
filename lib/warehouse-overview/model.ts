import type { IssueItem } from "../inventory/issues.ts";
import type { ViperQueueDto } from "../viper/orders/dto.ts";

export type SectionResult<T> = { ok: true; data: T; readAt: string } | { ok: false };
export type CountWork = { id: string; location_code: string; updated_at: string };
export type WarehouseActivity = { id: string; title: string; description: string | null; created_at: string };
export type OverviewReaders = {
  issues: () => Promise<IssueItem[]>;
  counts: () => Promise<{ items: CountWork[]; total: number }>;
  picks: () => Promise<ViperQueueDto>;
  activity: () => Promise<WarehouseActivity[]>;
};
export async function readSection<T>(read: () => Promise<T>): Promise<SectionResult<T>> {
  try { return { ok: true, data: await read(), readAt: new Date().toISOString() }; }
  catch { return { ok: false }; } // No database errors, metadata or credentials in UI.
}
export async function collectOverview(readers: OverviewReaders) {
  const [issues, counts, picks, activity] = await Promise.all([
    readSection(readers.issues), readSection(readers.counts), readSection(readers.picks), readSection(readers.activity),
  ]);
  return { issues, counts, picks, activity };
}
export type WarehouseOverviewData = Awaited<ReturnType<typeof collectOverview>>;
