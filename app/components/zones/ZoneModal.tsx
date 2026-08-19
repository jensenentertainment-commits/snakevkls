"use client";

type Props = {
  open: boolean;
  title: string;

  code: string;
  setCode: (value: string) => void;

  name: string;
  setName: (value: string) => void;

  pickPriority: string;
  setPickPriority: (value: string) => void;

  active: boolean;
  setActive: (value: boolean) => void;

  saving?: boolean;

  onClose: () => void;
  onSave: () => void;

  saveLabel: string;
};

export default function ZoneModal({
  open,
  title,
  code,
  setCode,
  name,
  setName,
  pickPriority,
  setPickPriority,
  active,
  setActive,
  saving = false,
  onClose,
  onSave,
  saveLabel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-white text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-[28px]">
        <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#055a7d]">
            Sone
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Administrer sonestrukturen som lokasjoner og produkter bygger på.
          </p>
        </div>

        <div className="px-6 py-5">
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Sonekode
          </label>

          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="f.eks. HL"
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#055a7d]/50 focus:ring-2 focus:ring-[#055a7d]/10"
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Navn
          </label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="f.eks. Hovedlager"
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#055a7d]/50 focus:ring-2 focus:ring-[#055a7d]/10"
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Plukkprioritet
          </label>

          <input
            type="number"
            min="1"
            step="1"
            value={pickPriority}
            onChange={(e) => setPickPriority(e.target.value)}
            placeholder="1"
            className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#055a7d]/50 focus:ring-2 focus:ring-[#055a7d]/10"
          />

          <p className="mt-2 text-xs text-neutral-500">
            Lavere tall plukkes først. Lokasjonskoden påvirkes ikke.
          </p>

          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-[#055a7d]"
            />

            <div>
              <p className="text-sm font-semibold text-neutral-800">
                Aktiv sone
              </p>
              <p className="text-xs text-neutral-500">
                Sonen kan brukes på lokasjoner og produkter.
              </p>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-neutral-50 px-6 py-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Avbryt
          </button>

          <button
            onClick={onSave}
            disabled={!code || !name || !pickPriority || saving}
            className="rounded-2xl bg-[#055a7d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#044c6a] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? "Lagrer..." : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
