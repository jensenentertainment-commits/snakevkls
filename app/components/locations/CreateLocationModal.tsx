"use client";

import type { ZoneOption } from "../products/types";


type Props = {
  open: boolean;
  zones: ZoneOption[];

  newCode: string;
  setNewCode: (value: string) => void;

  newZoneId: string;
  setNewZoneId: (value: string) => void;

  newPickSequence: string;
  setNewPickSequence: (value: string) => void;

  newActive: boolean;
  setNewActive: (value: boolean) => void;

  createSaving: boolean;

  onClose: () => void;
  onSave: () => void;
};

export default function CreateLocationModal({
  open,
  zones,
  newCode,
  setNewCode,
  newZoneId,
setNewZoneId,
  newPickSequence,
  setNewPickSequence,
  newActive,
  setNewActive,
  createSaving,
  onClose,
  onSave,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-white text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-[28px]">
        <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#055a7d]">
            Lokasjon
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Opprett lokasjon
          </h2>

          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Opprett en ny fysisk plassering i lagerstrukturen.
          </p>
        </div>

        <div className="px-6 py-5">
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Lokasjonskode
          </label>

          <input
            autoFocus
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Eks. A-01-02"
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#055a7d]/50 focus:ring-2 focus:ring-[#055a7d]/10"
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Sone
          </label>

          <select
            value={newZoneId}
onChange={(e) => setNewZoneId(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#055a7d]/50 focus:ring-2 focus:ring-[#055a7d]/10"
          >
            <option value="">Ingen sone</option>

            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.code} — {zone.name}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Fysisk plukknummer
          </label>

          <input
            type="number"
            min="1"
            step="1"
            value={newPickSequence}
            onChange={(e) => setNewPickSequence(e.target.value)}
            placeholder="Kan settes når fysisk rekkefølge er avklart"
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#055a7d]/50 focus:ring-2 focus:ring-[#055a7d]/10"
          />

          <p className="mt-2 text-xs text-neutral-500">
            Unikt innen sonen. Koden er fortsatt lokasjonens identitet.
          </p>

          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input
              type="checkbox"
              checked={newActive}
              onChange={(e) => setNewActive(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-[#055a7d] focus:ring-[#055a7d]"
            />

            <div>
              <p className="text-sm font-semibold text-neutral-800">
                Aktiv lokasjon
              </p>

              <p className="text-xs text-neutral-500">
                Lokasjonen kan brukes til plassering av varer.
              </p>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-neutral-50 px-6 py-5">
          <button
            onClick={onClose}
            disabled={createSaving}
            className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Avbryt
          </button>

          <button
            onClick={onSave}
            disabled={!newCode || createSaving}
            className="rounded-2xl bg-[#055a7d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#044c6a] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {createSaving ? "Oppretter..." : "Opprett"}
          </button>
        </div>
      </div>
    </div>
  );
}
