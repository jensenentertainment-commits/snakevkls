"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";
import { LagerDropdown } from "../components/lager/LagerDropdown";
import { LagerToolbar } from "../components/lager/LagerToolbar";
import { LagerHero } from "../components/lager/LagerHero";
import { logActivity } from "@/lib/activity";
import CreateLocationModal from "../components/locations/CreateLocationModal";
import { StatusBadge } from "../components/design-system";
type Zone = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

type LocationRow = {
  id: string;
  code: string;
  active: boolean;
  zone_id: string | null;
  pick_sequence: number | null;
  zones: {
    id: string;
    code: string;
    name: string;
  } | null;
  inventory: { id: string }[];
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newZoneId, setNewZoneId] = useState("");
  const [newPickSequence, setNewPickSequence] = useState("");
  const [newActive, setNewActive] = useState(true);
const [qrLocation, setQrLocation] = useState<LocationRow | null>(null);
const [qrDataUrl, setQrDataUrl] = useState("");
const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);
const [editCode, setEditCode] = useState("");
const [editZoneId, setEditZoneId] = useState("");
const [editPickSequence, setEditPickSequence] = useState("");
const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);

    const [zonesRes, locationsRes] = await Promise.all([
      supabase
        .from("zones")
        .select("id, code, name, active")
        .order("code", { ascending: true }),

      supabase
        .from("locations")
        .select(`
          id,
          code,
          active,
          zone_id,
          pick_sequence,
          zones (
            id,
            code,
            name
          ),
          inventory (
            id
          )
        `)
        .order("code", { ascending: true }), 
    ]);

    if (zonesRes.error) console.error("Feil ved henting av soner:", zonesRes.error);
    if (locationsRes.error) console.error("Feil ved henting av lokasjoner:", locationsRes.error);

    setZones((zonesRes.data as Zone[]) ?? []);
    setLocations((locationsRes.data as unknown as LocationRow[]) ?? []);
    setLoading(false);
  }

  async function handleCreateLocation() {
    const code = newCode.trim().toUpperCase();
    const pickSequence = newPickSequence ? Number(newPickSequence) : null;
    if (!code) return;
    if (
      pickSequence !== null &&
      (!newZoneId || !Number.isInteger(pickSequence) || pickSequence <= 0)
    ) {
      alert("Fysisk plukknummer krever en sone og et positivt heltall");
      return;
    }

    const { error } = await supabase.from("locations").insert({
      code,
      zone_id: newZoneId || null,
      active: newActive,
      pick_sequence: pickSequence,
    });

    

    if (error) {
      console.error("Feil ved oppretting av lokasjon:", error);
      return;
    }

await logActivity({
  entityType: "location",
  entityId: null,
  action: "location_created",
  title: "Lokasjon opprettet",
  description: code,
  metadata: {
    location_code: code,
    zone_id: newZoneId || null,
    pick_sequence: pickSequence,
    active: newActive,
  },
});
    
    setNewCode("");
    setNewZoneId("");
    setNewPickSequence("");
    setNewActive(true);
    setShowCreateModal(false);
    loadAll();
  }
async function handleShowQr(location: LocationRow) {
  const url = `${window.location.origin}/locations/${encodeURIComponent(
    location.code
  )}`;

  const dataUrl = await QRCode.toDataURL(url, {
    width: 320,
    margin: 2,
  });

  setQrLocation(location);
  setQrDataUrl(dataUrl);
}

async function handleSaveEditLocation() {
  if (!editingLocation) return;

  const code = editCode.trim().toUpperCase();
  const pickSequence = editPickSequence ? Number(editPickSequence) : null;

  if (!code) {
    alert("Lokasjonskode mangler");
    return;
  }
  if (
    pickSequence !== null &&
    (!editZoneId || !Number.isInteger(pickSequence) || pickSequence <= 0)
  ) {
    alert("Fysisk plukknummer krever en sone og et positivt heltall");
    return;
  }

 

  const { data, error } = await supabase
    .from("locations")
    .update({
      code,
      zone_id: editZoneId || null,
      active: editActive,
      pick_sequence: pickSequence,
    })
    .eq("id", editingLocation.id)
    .select("id, code, zone_id, pick_sequence, active");

  if (error) {
    alert(`Kunne ikke lagre: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    alert(
      "Ingen rad ble oppdatert. Mest sannsynlig RLS/policy eller feil id."
    );
    return;
  }

  await logActivity({
  entityType: "location",
  entityId: editingLocation.id,
  action: "location_updated",
  title: "Lokasjon endret",
  description: `${editingLocation.code} → ${code}`,
  metadata: {
    location_id: editingLocation.id,
    old_code: editingLocation.code,
    new_code: code,
    old_zone_id: editingLocation.zone_id,
    new_zone_id: editZoneId || null,
    old_pick_sequence: editingLocation.pick_sequence,
    new_pick_sequence: pickSequence,
    old_active: editingLocation.active,
    new_active: editActive,
  },
});

  setEditingLocation(null);
  setEditCode("");
  setEditZoneId("");
  setEditPickSequence("");
  setEditActive(true);

  await loadAll();
}
  async function handleToggleActive(location: LocationRow) {
    const { error } = await supabase
      .from("locations")
      .update({ active: !location.active })
      .eq("id", location.id);

    if (error) {
  console.error("Feil ved oppdatering av lokasjon:", error);
  return;
}

await logActivity({
  entityType: "location",
  entityId: location.id,
  action: location.active ? "location_deactivated" : "location_activated",
  title: location.active ? "Lokasjon deaktivert" : "Lokasjon aktivert",
  description: location.code,
  metadata: {
    location_id: location.id,
    location_code: location.code,
    old_active: location.active,
    new_active: !location.active,
  },
});

    setLocations((current) =>
      current.map((item) =>
        item.id === location.id ? { ...item, active: !item.active } : item
      )
    );
  }

  const filteredLocations = useMemo(() => {
    const q = query.trim().toLowerCase();

    return locations.filter((location) => {
      const matchesQuery =
        !q ||
        location.code.toLowerCase().includes(q) ||
        location.zones?.code.toLowerCase().includes(q) ||
        location.zones?.name.toLowerCase().includes(q);

      const matchesZone =
        selectedZone === "all" || location.zone_id === selectedZone;

      return matchesQuery && matchesZone;
    });
  }, [locations, query, selectedZone]);

  const activeCount = locations.filter((l) => l.active).length;
  const missingZoneCount = locations.filter((l) => !l.zone_id).length;
  const emptyLocationCount = locations.filter((l) => (l.inventory?.length ?? 0) === 0).length;

  return (
    <>
      <>
    <div className="overflow-hidden rounded-snake-shell shadow-snake-overlay">
      <LagerHero
  eyebrow="Snake / Lokasjoner"
  title="Lokasjoner"
  description="Administrer soner og lokasjoner i lageret. Opprett nye plasseringer, filtrer strukturen og se hvilke lokasjoner som er i bruk."
    searchValue={query}
  onSearchChange={setQuery}
  searchPlaceholder="Søk etter kode eller sone..."
/>

<LagerToolbar
  left={
    <>
      <button
        onClick={() => setSelectedZone("all")}
        className={`rounded-snake-control border px-3 py-2 text-sm font-semibold transition ${
  selectedZone === "all"
    ? "border-snake-brand/40 bg-snake-brand/12 text-snake-text-on-dark shadow-inner shadow-white/5"
    : "border-snake-border-on-dark-subtle bg-snake-app-elevated text-snake-text-on-dark-muted hover:bg-snake-app-elevated/90 hover:text-snake-text-on-dark"
}`}
      >
        Alle
      </button>

      <div className="rounded-snake-control bg-snake-app-elevated px-3 py-2 text-sm font-semibold text-snake-text-on-dark">
        Totale <span className="ml-1 text-snake-text-on-dark-muted">{locations.length}</span>
      </div>

      <div className="rounded-snake-control bg-snake-app-elevated px-3 py-2 text-sm font-semibold text-snake-text-on-dark">
        Aktive <span className="ml-1 text-snake-text-on-dark-muted">{activeCount}</span>
      </div>

      <div className="rounded-snake-control bg-snake-app-elevated px-3 py-2 text-sm font-semibold text-snake-text-on-dark">
        Uten sone <span className="ml-1 text-snake-text-on-dark-muted">{missingZoneCount}</span>
      </div>

      <div className="rounded-snake-control bg-snake-app-elevated px-3 py-2 text-sm font-semibold text-snake-text-on-dark">
        Tomme <span className="ml-1 text-snake-text-on-dark-muted">{emptyLocationCount}</span>
      </div>
    </>
  }
  right={
    <>
     <LagerDropdown
     variant="dark"
  value={selectedZone}
  onChange={(value) => {
    if (value === "__manage_zones") {
      window.location.href = "/zones";
      return;
    }

    setSelectedZone(value);
  }}
  width="w-full sm:w-[220px]"
  options={[
    { value: "all", label: "Alle soner" },
    ...zones.map((zone) => ({
      value: zone.id,
      label: `${zone.code} — ${zone.name}`,
    })),
    { value: "__manage_zones", label: "Administrer soner →" },
  ]}
/>

       <button
        onClick={() => setShowCreateModal(true)}
        className="inline-flex h-10 items-center gap-2 rounded-snake-control border border-snake-brand/30 bg-snake-brand/90 px-4 text-sm font-semibold text-snake-text-on-dark shadow-snake-card transition hover:bg-snake-brand-strong"
      >
        <Plus className="h-4 w-4" />
        Ny lokasjon
      </button>

      <Link
        href="/locations/labels"
        className="inline-flex h-10 items-center justify-center rounded-snake-control border border-snake-border-on-dark-subtle bg-snake-app-elevated px-4 text-sm font-semibold text-snake-text-on-dark transition hover:bg-snake-app-elevated/90 hover:text-snake-text-on-dark"
      >
        Print labels
      </Link>
    </>
  }
/>



<section className="bg-snake-surface px-5 py-6 text-snake-text-primary sm:px-8 sm:py-7">
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    {(query || selectedZone !== "all") && (
      <button
        onClick={() => {
          setQuery("");
          setSelectedZone("all");
        }}
        className="w-full rounded-snake-action border border-snake-border-strong bg-snake-surface px-4 py-3 text-sm font-semibold text-snake-text-secondary transition hover:bg-snake-surface-subtle sm:w-auto sm:py-2"
      >
        Nullstill filter
      </button>
    )}
  </div>

              <div className="overflow-hidden rounded-snake-action border border-snake-border-default bg-snake-surface shadow-snake-card">
                <div className="flex items-center justify-between border-b border-snake-border-default bg-snake-surface-subtle px-6 py-5">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-snake-text-primary">
                      Lokasjonsliste
                    </h2>
                    <p className="mt-1 text-sm text-snake-text-secondary">
  {loading
    ? "Børre henter lokasjoner."
    : emptyLocationCount > 0
      ? `Børre ser ${emptyLocationCount} tomme lokasjoner. Det kan være helt greit, eller lageret har vært kreativt.`
      : missingZoneCount > 0
        ? `Børre ser ${missingZoneCount} lokasjoner uten sone. Det er vanskelig å sortere ting uten rammer.`
        : "Børre finner ingen store lokasjonsproblemer akkurat nå."}
</p>
                  </div>

               <div className="flex flex-col items-start gap-2 sm:items-end">
  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-snake-text-disabled">
    {loading
      ? "Henter lokasjoner"
      : `Viser ${filteredLocations.length} av ${locations.length}`}
  </p>

  <Link
    href="/products"
    className="text-sm font-semibold text-snake-link underline-offset-4 hover:underline"
  >
    Gå til produkter
  </Link>
</div>
   </div>


                {/* Mobil / nettbrett */}
<div className="divide-y divide-neutral-100 lg:hidden">
  {loading ? (
    <MobileEmpty text="Laster lokasjoner..." />
  ) : filteredLocations.length === 0 ? (
    <MobileEmpty text="Ingen lokasjoner funnet." />
  ) : (
    filteredLocations.map((location) => (
     <MobileLocationCard
  key={location.id}
  location={location}
  onToggle={() => handleToggleActive(location)}
  onQr={() => handleShowQr(location)}
/>
    ))
  )}
</div>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-snake-surface text-left text-xs uppercase tracking-[0.14em] text-snake-text-muted">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Lokasjon</th>
                        <th className="px-5 py-4 font-semibold">Sone</th>
                        <th className="px-5 py-4 font-semibold">Plukknr.</th>
                        <th className="px-5 py-4 font-semibold">Produkter</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Handling</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <EmptyRow text="Laster lokasjoner..." />
                      ) : filteredLocations.length === 0 ? (
                        <EmptyRow text="Ingen lokasjoner funnet." />
                      ) : (
                        filteredLocations.map((location) => {
                          const productCount = location.inventory?.length ?? 0;

                          return (
                            <tr
                              key={location.id}
                              className="border-t border-snake-border-subtle transition hover:bg-snake-primary/[0.025]"
                            >
                              <td className="px-5 py-5 text-sm font-semibold text-snake-text-primary">
                                <Link
  href={`/locations/${encodeURIComponent(location.code)}`}
  className="inline-flex items-center gap-2 font-semibold text-snake-text-primary hover:text-snake-link"
>
  <MapPin className="h-4 w-4 text-snake-link" />
  {location.code}
</Link>
                              </td>

                              <td className="px-5 py-5 text-sm">
                                {location.zones ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-lg border border-snake-primary/20 bg-snake-primary/5 px-2 py-1 text-xs font-semibold text-snake-link">
                                      {location.zones.code}
                                    </span>
                                    <span className="text-snake-text-muted">
                                      {location.zones.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-semibold text-snake-brand-strong">
                                    Mangler sone
                                  </span>
                                )}
                              </td>

                              <td className="px-5 py-5 text-sm text-snake-text-secondary">
                                {location.pick_sequence ?? "Ikke satt"}
                              </td>

                              <td className="px-5 py-5 text-sm text-snake-text-secondary">
                                {productCount}
                              </td>

                              <td className="px-5 py-5 text-sm">
                                {location.active ? (
                                  <StatusBadge label="Aktiv" tone="success" />
                                ) : (
                                  <StatusBadge label="Inaktiv" tone="neutral" />
                                )}
                              </td>

                              <td className="px-5 py-5 text-sm">
  <div className="flex gap-3">
    <button
      onClick={() => handleToggleActive(location)}
      className="font-semibold text-snake-link underline-offset-4 hover:underline"
    >
      {location.active ? "Deaktiver" : "Aktiver"}
    </button>
<button
  onClick={() => {
    setEditingLocation(location);
    setEditCode(location.code);
    setEditZoneId(location.zone_id ?? "");
    setEditPickSequence(
      location.pick_sequence === null ? "" : String(location.pick_sequence)
    );
    setEditActive(location.active);
  }}
  className="font-semibold text-snake-text-secondary underline-offset-4 hover:underline"
>
  Rediger
</button>
    <button
      onClick={() => handleShowQr(location)}
      className="font-semibold text-snake-brand-strong underline-offset-4 hover:underline"
    >
      QR
    </button>
  </div>
</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
</div>

        <CreateLocationModal
  open={showCreateModal}
  zones={zones}
  newCode={newCode}
  setNewCode={setNewCode}
  newZoneId={newZoneId}
  setNewZoneId={setNewZoneId}
  newPickSequence={newPickSequence}
  setNewPickSequence={setNewPickSequence}
  newActive={newActive}
  setNewActive={setNewActive}
  createSaving={false}
  onClose={() => {
    setShowCreateModal(false);
    setNewCode("");
    setNewZoneId("");
    setNewPickSequence("");
    setNewActive(true);
  }}
  onSave={handleCreateLocation}
/>
      </>

     
      {qrLocation && (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--snake-color-overlay)] p-0 sm:items-center sm:p-4">
    <div className="w-full rounded-t-3xl bg-snake-surface p-6 text-snake-text-primary shadow-2xl sm:max-w-sm sm:rounded-snake-card">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-snake-link">
        QR-kode
      </p>

      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        {qrLocation.code}
      </h2>

      <p className="mt-2 text-sm text-snake-text-muted">
        Skann for å åpne lokasjonen direkte i Snake.
      </p>

      {qrDataUrl && (
        <div className="mt-6 rounded-snake-action border border-snake-border-default bg-snake-surface-subtle p-4">
          <img
            src={qrDataUrl}
            alt={`QR-kode for ${qrLocation.code}`}
            className="mx-auto h-64 w-64"
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            setQrLocation(null);
            setQrDataUrl("");
          }}
          className="rounded-snake-action border border-snake-border-strong px-5 py-3 text-sm font-semibold text-snake-text-secondary"
        >
          Lukk
        </button>

        <a
          href={qrDataUrl}
          download={`snake-${qrLocation.code}.png`}
          className="rounded-snake-action bg-snake-primary px-5 py-3 text-center text-sm font-semibold text-snake-text-on-dark"
        >
          Last ned
        </a>
        
      </div>
    </div>
  </div>
  
)}
{editingLocation && (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--snake-color-overlay)] p-0 sm:items-center sm:p-4">
    <div className="w-full rounded-t-3xl bg-snake-surface p-6 text-snake-text-primary shadow-2xl sm:max-w-md sm:rounded-snake-card">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-snake-link">
        Rediger lokasjon
      </p>

      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        {editingLocation.code}
      </h2>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-snake-text-secondary">
            Lokasjonskode
          </label>
          <input
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            className="w-full rounded-snake-action border border-snake-border-strong px-4 py-3 text-sm outline-none focus:border-snake-primary"
          />
        </div>

        <div>
  <label className="mb-2 block text-sm font-medium text-snake-text-secondary">
    Sone
  </label>

  <select
    value={editZoneId}
    onChange={(e) => setEditZoneId(e.target.value)}
    className="w-full rounded-snake-action border border-snake-border-strong px-4 py-3 text-sm outline-none focus:border-snake-primary"
  >
    <option value="">Ingen sone</option>
    {zones.map((zone) => (
      <option key={zone.id} value={zone.id}>
        {zone.code} — {zone.name}
      </option>
    ))}
  </select>
</div>

        <div>
          <label className="mb-2 block text-sm font-medium text-snake-text-secondary">
            Fysisk plukknummer
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={editPickSequence}
            onChange={(e) => setEditPickSequence(e.target.value)}
            placeholder="Ikke satt"
            className="w-full rounded-snake-action border border-snake-border-strong px-4 py-3 text-sm outline-none focus:border-snake-primary"
          />
          <p className="mt-2 text-xs text-snake-text-muted">
            Unikt innen sonen og uavhengig av lokasjonskoden.
          </p>
        </div>

        <label className="flex items-center gap-3 rounded-snake-action border border-snake-border-default bg-snake-surface-subtle px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={editActive}
            onChange={(e) => setEditActive(e.target.checked)}
          />
          Aktiv lokasjon
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={() => setEditingLocation(null)}
          className="rounded-snake-action border border-snake-border-strong px-5 py-3 text-sm font-semibold text-snake-text-secondary"
        >
          Avbryt
        </button>

        <button
          onClick={handleSaveEditLocation}
          className="rounded-snake-action bg-snake-primary px-5 py-3 text-sm font-semibold text-snake-text-on-dark"
        >
          Lagre
        </button>
      </div>
    </div>
  </div>
)}
    </>
  );
}

function MobileLocationCard({
  location,
  onToggle,
  onQr,
}: {
  location: LocationRow;
  onToggle: () => void;
  onQr: () => void;
}) {
  const productCount = location.inventory?.length ?? 0;

  return (
    <article className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-base font-semibold text-snake-text-primary">
            <MapPin className="h-4 w-4 text-snake-link" />
            {location.code}
          </p>

          <div className="mt-3">
            {location.zones ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-snake-primary/20 bg-snake-primary/5 px-2 py-1 text-xs font-semibold text-snake-link">
                  {location.zones.code}
                </span>
                <span className="text-sm text-snake-text-muted">
                  {location.zones.name}
                </span>
              </div>
            ) : (
              <span className="font-semibold text-snake-brand-strong">
                Mangler sone
              </span>
            )}
          </div>
        </div>

        {location.active ? (
          <StatusBadge label="Aktiv" tone="success" />
        ) : (
          <StatusBadge label="Inaktiv" tone="neutral" />
        )}
      </div>

      <div className="mt-4 rounded-snake-action bg-snake-surface-subtle p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-snake-text-muted">Produkter</span>
          <span className="text-base font-semibold text-snake-text-primary">
            {productCount}
          </span>
        </div>
      </div>

       <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={onToggle}
          className="rounded-snake-action bg-snake-primary px-4 py-3 text-sm font-semibold text-snake-text-on-dark"
        >
          {location.active ? "Deaktiver" : "Aktiver"}
        </button>

        <button
          onClick={onQr}
          className="rounded-snake-action border border-snake-brand-strong/25 bg-snake-brand-strong/10 px-4 py-3 text-sm font-semibold text-snake-brand-strong"
        >
          QR
        </button>
      </div>
    </article>
  );
}

function MobileEmpty({ text }: { text: string }) {
  return <div className="px-5 py-10 text-sm text-snake-text-muted">{text}</div>;
}
function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={6} className="px-5 py-12 text-sm text-snake-text-muted">
        {text}
      </td>
    </tr>
  );
}
