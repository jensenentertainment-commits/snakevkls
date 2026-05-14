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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-white p-6 text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          Registrer uttak
        </h2>

        <p className="mt-2 text-sm text-neutral-500">
          {product.product_name}
        </p>

        <input
          type="number"
          min="1"
          value={movementQty}
          onChange={(e) => setMovementQty(e.target.value)}
          className="mt-6 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm"
        />

        <select
          value={movementReason}
          onChange={(e) => setMovementReason(e.target.value)}
          className="mt-4 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm"
        >
          <option value="manual_sale">Solgt manuelt</option>
          <option value="waste">Svinn</option>
          <option value="internal_use">Intern bruk</option>
          <option value="correction">Korrigering</option>
          <option value="other">Annet</option>
        </select>

        <textarea
          value={movementNote}
          onChange={(e) => setMovementNote(e.target.value)}
          className="mt-4 min-h-[90px] w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm"
          placeholder="Kommentar, valgfritt"
        />

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            disabled={movementSaving}
            className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            Avbryt
          </button>

          <button
            onClick={onSave}
            disabled={movementSaving}
            className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {movementSaving ? "Lagrer..." : "Registrer"}
          </button>
        </div>
      </div>
    </div>
  );
}