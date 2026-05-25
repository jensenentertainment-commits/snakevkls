import type { ZoneOption } from "./types";

type Props = {
  selectedCount: number;
  zones: ZoneOption[];
  batchZone: string;
  setBatchZone: (value: string) => void;
  batchSaving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function BatchAssignModal({
  selectedCount,
  zones,
  batchZone,
  setBatchZone,
  batchSaving,
  onClose,
  onSave,
}: Props) {
 return (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
    <div className="w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-white text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-[28px]">
      <div className="border-b border-neutral-200 bg-[#fbf6e8] px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a6704]">
          Batch assign
        </p>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          Sett sone på {selectedCount} produkter
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Produktene får sone nå. Eksakt lokasjon kan settes senere.
        </p>
      </div>

      <div className="px-6 py-5">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Sone
        </label>

        <select
          value={batchZone}
          onChange={(e) => setBatchZone(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#b58a14]/50 focus:ring-2 focus:ring-[#b58a14]/10"
        >
          <option value="">Velg sone</option>

          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.code} — {zone.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-neutral-50 px-6 py-5">
        <button
          onClick={onClose}
          disabled={batchSaving}
          className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Avbryt
        </button>

        <button
          onClick={onSave}
          disabled={!batchZone || batchSaving}
          className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a77e05] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {batchSaving ? "Lagrer..." : "Sett sone"}
        </button>
      </div>
    </div>
  </div>
);
}