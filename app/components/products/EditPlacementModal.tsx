import type {
  LocationOption,
  ProductRow,
  ZoneOption,
} from "./types";

type Props = {
  editing: ProductRow;
  locations: LocationOption[];
  zones: ZoneOption[];

  newZone: string;
  setNewZone: (value: string) => void;

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
  newZone,
  setNewZone,
  newLocation,
  setNewLocation,
  newQuantity,
  setNewQuantity,
  saveSaving,
  onClose,
  onSave,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-white p-6 text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
          Endre plassering
        </p>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {editing.sku || "Produkt uten SKU"}
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {editing.product_name}
        </p>

        <label className="mt-6 block text-sm font-medium text-neutral-700">
          Sone
        </label>

        <select
          autoFocus
          value={newZone}
          onChange={(e) => {
            setNewZone(e.target.value);
            setNewLocation("");
          }}
          className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
        >
          <option value="">Velg sone</option>

          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.code} — {zone.name}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Lokasjon
        </label>

        <select
          value={newLocation}
          onChange={(e) => {
            const locationId = e.target.value;

            const location = locations.find(
              (item) => item.id === locationId
            );

            setNewLocation(locationId);

            if (location?.zone_id) {
              setNewZone(location.zone_id);
            }
          }}
          className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
        >
          <option value="">Ingen eksakt lokasjon ennå</option>

          {locations
            .filter((location) =>
              newZone ? location.zone_id === newZone : true
            )
            .map((location) => (
              <option key={location.id} value={location.id}>
                {location.code}
              </option>
            ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Antall
        </label>

        <input
          type="number"
          min="0"
          value={newQuantity}
          onChange={(e) => setNewQuantity(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
        />

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700"
          >
            Avbryt
          </button>

          <button
            onClick={onSave}
            disabled={saveSaving}
            className="rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saveSaving ? "Lagrer..." : "Lagre"}
          </button>
        </div>
      </div>
    </div>
  );
}