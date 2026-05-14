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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-white p-6 text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
          Batch assign
        </p>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          Sett sone på {selectedCount} produkter
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Produktene får sone nå. Eksakt lokasjon kan settes senere.
        </p>

        <label className="mt-6 block text-sm font-medium text-neutral-700">
          Sone
        </label>

        <select
          value={batchZone}
          onChange={(e) => setBatchZone(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
        >
          <option value="">Velg sone</option>

          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.code} — {zone.name}
            </option>
          ))}
        </select>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            disabled={batchSaving}
            className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Avbryt
          </button>

          <button
            onClick={onSave}
            disabled={!batchZone || batchSaving}
            className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {batchSaving ? "Lagrer..." : "Sett sone"}
          </button>
        </div>
      </div>
    </div>
  );
}