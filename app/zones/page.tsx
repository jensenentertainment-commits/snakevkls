"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeHero from "../components/SnakeHero";
import SnakeToolbar from "../components/SnakeToolbar";
import RoleGate from "../components/auth/RoleGate";
import ZoneModal from "../components/zones/ZoneModal";

type ZoneRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  locations: { id: string }[];
};

export default function ZonesPage() {
  return (
    <RoleGate allowedRoles={["admin"]} withinAppShell>
      <ZonesContent />
    </RoleGate>
  );
}

function ZonesContent() {
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newActive, setNewActive] = useState(true);

  const [editingZone, setEditingZone] = useState<ZoneRow | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);

  const [query, setQuery] = useState("");
const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    loadZones();
  }, []);

  async function loadZones() {
    setLoading(true);

    const { data, error } = await supabase
      .from("zones")
      .select(`
        id,
        code,
        name,
        active,
        locations (
          id
        )
      `)
      .order("code", { ascending: true });

    if (error) {
      console.error("Feil ved henting av soner:", error);
      setZones([]);
    } else {
      setZones((data as unknown as ZoneRow[]) ?? []);
    }

    setLoading(false);
  }

  async function handleCreateZone() {
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();

    if (!code || !name) {
      alert("Sonekode og navn må fylles ut");
      return;
    }

    const { error } = await supabase.from("zones").insert({
      code,
      name,
      active: newActive,
    });

    if (error) {
      alert(`Kunne ikke opprette sone: ${error.message}`);
      return;
    }

    setShowCreateModal(false);
    setNewCode("");
    setNewName("");
    setNewActive(true);

    await loadZones();
  }

  async function handleSaveZone() {
    if (!editingZone) return;

    const code = editCode.trim().toUpperCase();
    const name = editName.trim();

    if (!code || !name) {
      alert("Sonekode og navn må fylles ut");
      return;
    }

    const { error } = await supabase
      .from("zones")
      .update({
        code,
        name,
        active: editActive,
      })
      .eq("id", editingZone.id);

    if (error) {
      alert(`Kunne ikke lagre sone: ${error.message}`);
      return;
    }

    setEditingZone(null);
    setEditCode("");
    setEditName("");
    setEditActive(true);

    await loadZones();
  }
const filteredZones = useMemo(() => {
  let result = zones;

  const q = query.trim().toLowerCase();

  if (q) {
    result = result.filter(
      (zone) =>
        zone.code.toLowerCase().includes(q) ||
        zone.name.toLowerCase().includes(q)
    );
  }

  if (statusFilter === "active") {
    result = result.filter((zone) => zone.active);
  }

  if (statusFilter === "inactive") {
    result = result.filter((zone) => !zone.active);
  }

  return result;
}, [zones, query, statusFilter]);
  const activeCount = zones.filter((z) => z.active).length;
  const inactiveCount = zones.filter((z) => !z.active).length;
  const totalLocations = zones.reduce(
    (sum, zone) => sum + (zone.locations?.length ?? 0),
    0
  );

  return (
    <>
      <div className="overflow-hidden rounded-[26px] shadow-2xl shadow-black/30 sm:rounded-[32px]">
   <SnakeHero
  eyebrow="SNAKE / SONER"
  title="Soner"
  description="Soner styrer hvor lokasjoner hører hjemme og gjør lageret lettere å rydde senere."
  searchValue={query}
  onSearchChange={setQuery}
  searchPlaceholder="Søk etter sonekode eller navn"
/>

<SnakeToolbar
  left={
    <>
      {[
        { key: "all", label: "Alle", value: zones.length },
        { key: "active", label: "Aktive", value: activeCount },
        { key: "inactive", label: "Inaktive", value: inactiveCount },
      ].map((filter) => (
        <button
          key={filter.key}
          onClick={() =>
            setStatusFilter(filter.key as "all" | "active" | "inactive")
          }
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
  statusFilter === filter.key
    ? "border-[#b58a14]/40 bg-[#b58a14]/12 text-white shadow-inner shadow-white/5"
    : "border-white/10 bg-white/[0.06] text-white/75 hover:bg-white/[0.09] hover:text-white"
}`}
        >
          {filter.label}
          <span className="ml-1 text-white/65">{filter.value}</span>
        </button>
      ))}

      <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white/80">
        Lokasjoner <span className="ml-1 text-white/65">{totalLocations}</span>
      </div>
    </>
  }
  right={
    <button
      onClick={() => setShowCreateModal(true)}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#b58a14]/30 bg-[#b58a14]/90 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a77e05]"
    >
      <Plus className="h-4 w-4" />
      Ny sone
    </button>
  }
/>
  
            

            <section className="bg-white px-5 py-6 text-neutral-950 sm:px-8 sm:py-7">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                    Sonestruktur
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {loading
                      ? "Henter soner..."
                      : `${filteredZones.length} av ${zones.length} soner vises`}
                  </p>
                </div>

                <div className="divide-y divide-neutral-100 lg:hidden">
                  {loading ? (
                    <EmptyState text="Laster soner..." />
                  ) : filteredZones.length === 0 ? (
                    <EmptyState text="Ingen soner opprettet." />
                  ) : (
                    filteredZones.map((zone) => (
                      <ZoneMobileCard
                        key={zone.id}
                        zone={zone}
                        onEdit={() => {
                          setEditingZone(zone);
                          setEditCode(zone.code);
                          setEditName(zone.name);
                          setEditActive(zone.active);
                        }}
                      />
                    ))
                  )}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full border-collapse">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Kode</th>
                        <th className="px-5 py-4 font-semibold">Navn</th>
                        <th className="px-5 py-4 font-semibold">Lokasjoner</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Handling</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-sm text-neutral-500">
                            Laster soner...
                          </td>
                        </tr>
                      ) : filteredZones.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-sm text-neutral-500">
                            Ingen soner opprettet.
                          </td>
                        </tr>
                      ) : (
                        filteredZones.map((zone) => (
                          <tr
                            key={zone.id}
                            className="border-t border-neutral-100 transition hover:bg-[#055a7d]/[0.025]"
                          >
                            <td className="px-5 py-5 text-sm font-semibold text-neutral-950">
                              {zone.code}
                            </td>
                            <td className="px-5 py-5 text-sm text-neutral-700">
                              {zone.name}
                            </td>
                            <td className="px-5 py-5 text-sm text-neutral-700">
                              {zone.locations?.length ?? 0}
                            </td>
                            <td className="px-5 py-5 text-sm">
                              {zone.active ? (
                                <StatusPill text="Aktiv" tone="ok" />
                              ) : (
                                <StatusPill text="Inaktiv" tone="neutral" />
                              )}
                            </td>
                            <td className="px-5 py-5 text-sm">
                              <button
                                onClick={() => {
                                  setEditingZone(zone);
                                  setEditCode(zone.code);
                                  setEditName(zone.name);
                                  setEditActive(zone.active);
                                }}
                                className="font-semibold text-[#055a7d] underline-offset-4 hover:underline"
                              >
                                Rediger
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
      </div>

     <ZoneModal
  open={showCreateModal}
  title="Ny sone"
  code={newCode}
  name={newName}
  active={newActive}
  setCode={setNewCode}
  setName={setNewName}
  setActive={setNewActive}
  onClose={() => {
    setShowCreateModal(false);
    setNewCode("");
    setNewName("");
    setNewActive(true);
  }}
  onSave={handleCreateZone}
  saveLabel="Opprett"
/>

<ZoneModal
  open={Boolean(editingZone)}
  title={`Rediger ${editingZone?.code ?? "sone"}`}
  code={editCode}
  name={editName}
  active={editActive}
  setCode={setEditCode}
  setName={setEditName}
  setActive={setEditActive}
  onClose={() => {
    setEditingZone(null);
    setEditCode("");
    setEditName("");
    setEditActive(true);
  }}
  onSave={handleSaveZone}
  saveLabel="Lagre"
/>
  </>
  );
}

function ZoneMobileCard({
  zone,
  onEdit,
}: {
  zone: ZoneRow;
  onEdit: () => void;
}) {
  return (
    <article className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-neutral-950">{zone.code}</p>
          <p className="mt-1 text-sm text-neutral-600">{zone.name}</p>
        </div>

        {zone.active ? (
          <StatusPill text="Aktiv" tone="ok" />
        ) : (
          <StatusPill text="Inaktiv" tone="neutral" />
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-500">Lokasjoner</span>
          <span className="text-base font-semibold text-neutral-950">
            {zone.locations?.length ?? 0}
          </span>
        </div>
      </div>

      <button
        onClick={onEdit}
        className="mt-4 w-full rounded-2xl bg-[#055a7d] px-4 py-3 text-sm font-semibold text-white"
      >
        Rediger sone
      </button>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-5 py-10 text-sm text-neutral-500">{text}</div>;
}



function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: "ok" | "neutral";
}) {
  const styles = {
    ok: "border-[#14565b]/30 bg-[#14565b]/10 text-[#14565b]",
    neutral: "border-neutral-200 bg-neutral-100 text-neutral-600",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${styles[tone]}`}
    >
      {text}
    </span>
  );
}
