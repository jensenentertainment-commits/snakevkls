import type { ProductRow } from "./types";

type Props = {
  product: ProductRow;
  movementQty: string;
  setMovementQty: (value: string) => void;
  movementReason: string;
  setMovementReason: (value: string) => void;
  movementNote: string;
  setMovementNote: (value: string) => void;
  movementSaving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function StockMovementModal({
  product,
  movementQty,
  setMovementQty,
  movementReason,
  setMovementReason,
  movementNote,
  setMovementNote,
  movementSaving,
  onClose,
  onSave,
}: Props) {
 return (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
    <div className="w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-white text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-[28px]">
      <div className="border-b border-neutral-200 bg-[#fbf6e8] px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a6704]">
          Lagerbevegelse
        </p>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          Registrer uttak
        </h2>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">
          {product.product_name}
        </p>
      </div>

      <div className="px-6 py-5">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Antall
        </label>

        <input
          type="number"
          min="1"
          value={movementQty}
          onChange={(e) => setMovementQty(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#b58a14]/50 focus:ring-2 focus:ring-[#b58a14]/10"
        />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Årsak
        </label>

        <select
          value={movementReason}
          onChange={(e) => setMovementReason(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#b58a14]/50 focus:ring-2 focus:ring-[#b58a14]/10"
        >
          <option value="manual_sale">Solgt manuelt</option>
          <option value="waste">Svinn</option>
          <option value="internal_use">Intern bruk</option>
          <option value="correction">Korrigering</option>
          <option value="other">Annet</option>
        </select>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Kommentar
        </label>

        <textarea
          value={movementNote}
          onChange={(e) => setMovementNote(e.target.value)}
          className="mt-2 min-h-[100px] w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 shadow-sm outline-none transition focus:border-[#b58a14]/50 focus:ring-2 focus:ring-[#b58a14]/10"
          placeholder="Kommentar, valgfritt"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-neutral-50 px-6 py-5">
        <button
          onClick={onClose}
          disabled={movementSaving}
          className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Avbryt
        </button>

        <button
          onClick={onSave}
          disabled={movementSaving}
          className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a77e05] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {movementSaving ? "Lagrer..." : "Registrer"}
        </button>
      </div>
    </div>
  </div>
);
}