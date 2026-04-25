"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Settings, Layers, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";

type ZoneRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  locations: { id: string }[];
};

export default function SettingsPage() {
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

  const activeCount = zones.filter((z) => z.active).length;
  const inactiveCount = zones.filter((z) => !z.active).length;
  const totalLocations = zones.reduce(
    (sum, zone) => sum + (zone.locations?.length ?? 0),
    0
  );

  return (
    <>
      <main className="min-h-screen bg-[#062f3b] text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
          <SnakeNav />

          <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
            <div className="grid gap-7 bg-gradient-to-br from-[#055a7d] to-[#042834] px-5 py-7 text-white sm:px-10 sm:py-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/65">
                  SNAKE / Settings
                </p>

                <h1 className="mt-3 text-4xl font-semibold leading-[0.95] tracking-tight sm:text-5xl">
                  Innstillinger
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
                  Administrer grunnstrukturen i Snake. Start med soner, slik at
                  lokasjoner kan organiseres uten SQL og manuell databasejobb.
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex w-fit items-center gap-2 rounded-2xl bg-[#b58a14] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                Ny sone
              </button>
            </div>

            <div className="grid gap-3 bg-[#f6f7f8] px-5 py-5 sm:grid-cols-2 sm:px-8 sm:py-6 lg:grid-cols-4">
              <StatCard icon={<Settings />} label="Soner" value={zones.length} tone="blue" />
              <StatCard icon={<CheckCircle2 />} label="Aktive" value={activeCount} tone="ok" />
              <StatCard icon={<AlertTriangle />} label="Inaktive" value={inactiveCount} tone="neutral" />
              <StatCard icon={<Layers />} label="Lokasjoner" value={totalLocations} tone="gold" />
            </div>

            <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                    Sonestruktur
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {loading
                      ? "Henter soner..."
                      : `${zones.length} soner registrert`}
                  </p>
                </div>

                <div className="divide-y divide-neutral-100 lg:hidden">
                  {loading ? (
                    <EmptyState text="Laster soner..." />
                  ) : zones.length === 0 ? (
                    <EmptyState text="Ingen soner opprettet." />
                  ) : (
                    zones.map((zone) => (
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
                    <thead className="bg-white text-left text-xs uppercase tracking-[0.14em] text-neutral-500">
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
                      ) : zones.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-sm text-neutral-500">
                            Ingen soner opprettet.
                          </td>
                        </tr>
                      ) : (
                        zones.map((zone) => (
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
            </div>
          </section>

          <SnakeFooter />
        </div>
      </main>

      {showCreateModal && (
        <ZoneModal
          title="Ny sone"
          code={newCode}
          name={newName}
          active={newActive}
          setCode={setNewCode}
          setName={setNewName}
          setActive={setNewActive}
          onCancel={() => {
            setShowCreateModal(false);
            setNewCode("");
            setNewName("");
            setNewActive(true);
          }}
          onSave={handleCreateZone}
          saveLabel="Opprett"
        />
      )}

      {editingZone && (
        <ZoneModal
          title={`Rediger ${editingZone.code}`}
          code={editCode}
          name={editName}
          active={editActive}
          setCode={setEditCode}
          setName={setEditName}
          setActive={setEditActive}
          onCancel={() => {
            setEditingZone(null);
            setEditCode("");
            setEditName("");
            setEditActive(true);
          }}
          onSave={handleSaveZone}
          saveLabel="Lagre"
        />
      )}
    </>
  );
}

function ZoneModal({
  title,
  code,
  name,
  active,
  setCode,
  setName,
  setActive,
  onCancel,
  onSave,
  saveLabel,
}: {
  title: string;
  code: string;
  name: string;
  active: boolean;
  setCode: (value: string) => void;
  setName: (value: string) => void;
  setActive: (value: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-white p-6 text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
          Sone
        </p>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {title}
        </h2>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Sonekode
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="f.eks. HL"
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Navn
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="f.eks. Hovedlager"
              className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-[#055a7d]"
            />
            Aktiv sone
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700"
          >
            Avbryt
          </button>

          <button
            onClick={onSave}
            className="rounded-2xl bg-[#055a7d] px-5 py-3 text-sm font-semibold text-white"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
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

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "blue" | "gold" | "ok" | "neutral";
}) {
  const styles = {
    blue: "border-t-[#055a7d] text-[#055a7d]",
    gold: "border-t-[#a77e05] text-[#a77e05]",
    ok: "border-t-emerald-500 text-emerald-600",
    neutral: "border-t-neutral-300 text-neutral-500",
  };

  return (
    <div
      className={`rounded-2xl border border-neutral-200 border-t-4 bg-white p-4 shadow-sm sm:p-5 ${styles[tone]}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 sm:mt-3 sm:text-3xl">
            {value}
          </p>
        </div>

        <div className="[&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: "ok" | "neutral";
}) {
  const styles = {
    ok: "border-green-200 bg-green-50 text-green-700",
    neutral: "border-neutral-200 bg-neutral-100 text-neutral-600",
  };

  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {text}
    </span>
  );
}