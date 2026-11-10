import { LocationPicker } from "./LocationPicker";
import type {
  LocationOption,
  ProductRow,
  ZoneOption,
} from "./types";

type Props = {
  editing: ProductRow;
  locations: LocationOption[];
  zones: ZoneOption[];


  newLocation: string;
  setNewLocation: (value: string) => void;

  newQuantity: string;
  setNewQuantity: (value: string) => void;

  saveSaving: boolean;

  onClose: () => void;
  onSave: () => void;
};

export default function EditPlacementModal({
  editing,
  locations,
  zones,
  newLocation,
  setNewLocation,
  newQuantity,
  setNewQuantity,
  saveSaving,
  onClose,
  onSave,
}: Props) {
  return (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
    <div className="max-h-[95dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-white text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-[28px]">
      <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#055a7d]">
          Endre plassering
        </p>

        <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">
          {editing.sku || "Produkt uten SKU"}
        </h2>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">
          {editing.product_name}
        </p>
      </div>

      <div className="px-6 py-5">
        <label htmlFor="placement-location" className="block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Lokasjon
        </label>

        <LocationPicker locations={locations} zones={zones} value={newLocation} onChange={setNewLocation} />

        <p className="mt-2 text-sm text-neutral-500">Sone: {zones.find((zone) => zone.id === locations.find((location) => location.id === newLocation)?.zone_id)?.code ?? "Velg lokasjon først"}</p>
        <label htmlFor="placement-quantity" className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Antall
        </label>

        <input
          id="placement-quantity"
          type="number"
          min="0"
          value={newQuantity}
          onChange={(e) => setNewQuantity(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm outline-none transition focus:border-[#055a7d]/50 focus:ring-2 focus:ring-[#055a7d]/10"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 bg-neutral-50 px-6 py-5">
        <button
          onClick={onClose}
          className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400"
        >
          Avbryt
        </button>

        <button
          onClick={onSave}
          disabled={saveSaving || !locations.some((location) => location.id === newLocation && location.zone_id)}
          className="rounded-2xl bg-[#055a7d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#044c6a] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saveSaving ? "Lagrer..." : "Lagre"}
        </button>
      </div>
    </div>
  </div>
);
}
