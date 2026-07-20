"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";
import SnakeHero from "../components/SnakeHero";
import SnakeToolbar from "../components/SnakeToolbar";
import RoleGate from "../components/auth/RoleGate";
import type { Role } from "@/lib/auth/roles";



type UserProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
};

type ZoneRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  locations: { id: string }[];
};

export default function SettingsPage() {
  return (
    <RoleGate allowedRoles={["admin"]}>
      <SettingsContent />
    </RoleGate>
  );
}

function SettingsContent() {
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newActive, setNewActive] = useState(true);

  const [editingZone, setEditingZone] = useState<ZoneRow | null>(null);

  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");

  const [newUserRole, setNewUserRole] = useState<Role>("lager");

  const [newUserActive, setNewUserActive] = useState(true);

  const [creatingUser, setCreatingUser] = useState(false);

  const [query, setQuery] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "inactive">("all");;

useEffect(() => {
  loadZones();
  loadUsers();
  loadCurrentUser();
}, []);

async function loadUsers() {
  setUsersLoading(true);

  try {
    const res = await fetch("/api/admin/users", {
      cache: "no-store",
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error ?? "Kunne ikke hente brukere");
    }

    setUsers(json.users ?? []);
  } catch (error) {
    console.error(error);
    setUsers([]);
  } finally {
    setUsersLoading(false);
  }
}

async function loadCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  setCurrentUserId(user?.id ?? null);
}

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

  async function handleCreateUser() {
  if (creatingUser) return;

  setCreatingUser(true);

  try {
    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: newUserEmail,
        password: newUserPassword,
        displayName: newUserDisplayName,
        role: newUserRole,
        active: newUserActive,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result?.error || "Kunne ikke opprette bruker");
    }

    setShowCreateUserModal(false);
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserDisplayName("");
    setNewUserRole("lager");
    setNewUserActive(true);

    await loadUsers();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunne ikke opprette bruker";

    alert(message);
  } finally {
    setCreatingUser(false);
  }
}

  async function handleUpdateUser(
  userId: string,
  updates: {
    displayName?: string | null;
    role?: Role;
    active?: boolean;
  }
) {
  try {
    const res = await fetch("/api/admin/users/update-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        ...updates,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result?.error || "Kunne ikke oppdatere bruker");
    }

    await loadUsers();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunne ikke oppdatere bruker";

    alert(message);
  }
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
      <main className="min-h-screen bg-[#062f3b] text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
          <SnakeNav />

          <section className="overflow-hidden rounded-[26px] bg-white text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
   <SnakeHero
  eyebrow="SNAKE / SYSTEM"
  title="System"
  description="Administrer grunnstrukturen i Snake. Soner styrer hvor lokasjoner hører hjemme og gjør lageret lettere å rydde senere."
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
  
            

            <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7">
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
            </div>
            <div className="border-t border-neutral-200 bg-white px-5 py-6 sm:px-8 sm:py-7">
 <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
    <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
  <div className="flex items-center justify-between gap-4">
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
        Brukere i Snake
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Administrer hvem som har tilgang til Snake.
      </p>
    </div>

    <button
      onClick={() => setShowCreateUserModal(true)}
      className="rounded-xl bg-[#055a7d] px-4 py-2 text-sm font-semibold text-white"
    >
      Ny bruker
    </button>
  </div>
</div>

<div className="mb-6 flex flex-wrap items-center gap-3">
  <div className="rounded-2xl bg-[#055a7d]/10 px-4 py-2 text-sm font-semibold text-[#055a7d]">
    {users.length} brukere
  </div>

  <div className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
    {users.filter((u) => u.active).length} aktive
  </div>

  <div className="rounded-2xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600">
    {users.filter((u) => !u.active).length} deaktivert
  </div>
</div>

 {usersLoading ? (
  <EmptyState text="Henter brukere..." />
) : users.length === 0 ? (
  <EmptyState text="Ingen brukere funnet." />
) : (
 <div className="space-y-3 px-6 pb-6">
    {users.map((user) => (
      <div
        key={user.id}
        className="grid items-center gap-4 rounded-3xl border border-black/10 bg-neutral-50 p-4 lg:grid-cols-[1fr_180px_120px_140px]"
      >
        <UserNameEditor
          userId={user.id}
          initialValue={user.display_name || ""}
          email={user.email}
        />

        <select
          value={user.role}
          onChange={(e) =>
            handleUpdateUser(user.id, {
              role: e.target.value as Role,
            })
          }
          className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm"
        >
          <option value="admin">Admin</option>
          <option value="lager">Lager</option>
        </select>

        <div
          className={`inline-flex h-10 items-center justify-center rounded-full px-3 text-xs font-bold uppercase tracking-[0.12em] ${
            user.active
              ? "bg-emerald-100 text-emerald-700"
              : "bg-neutral-200 text-neutral-500"
          }`}
        >
          {user.active ? "Aktiv" : "Deaktivert"}
        </div>

        <button
          type="button"
          disabled={user.id === currentUserId}
          onClick={() =>
            handleUpdateUser(user.id, {
              active: !user.active,
            })
          }
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            user.active
              ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {user.id === currentUserId
            ? "Din bruker"
            : user.active
              ? "Deaktiver"
              : "Aktiver"}
        </button>
      </div>
    ))}
  </div>
)}
</div>
</div>


          </section>

          <SnakeFooter />
        </div>
      </main>
{showCreateUserModal && (
  <CreateUserModal
    email={newUserEmail}
    setEmail={setNewUserEmail}
    password={newUserPassword}
    setPassword={setNewUserPassword}
    displayName={newUserDisplayName}
    setDisplayName={setNewUserDisplayName}
    role={newUserRole}
    setRole={setNewUserRole}
    active={newUserActive}
    setActive={setNewUserActive}
    saving={creatingUser}
    onCancel={() => {
      setShowCreateUserModal(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserDisplayName("");
      setNewUserRole("lager");
      setNewUserActive(true);
    }}
    onSave={handleCreateUser}
  />
)}
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

function CreateUserModal({
  email,
  setEmail,
  password,
  setPassword,
  displayName,
  setDisplayName,
  role,
  setRole,
  active,
  setActive,
  saving,
  onCancel,
  onSave,
}: {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  role: Role;
  setRole: (value: Role) => void;
  active: boolean;
  setActive: (value: boolean) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-white p-6 text-neutral-950 shadow-2xl sm:max-w-md sm:rounded-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
          Bruker
        </p>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          Ny bruker
        </h2>

        <div className="mt-6 space-y-4">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Visningsnavn"
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-post"
            type="email"
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Midlertidig passord"
            type="password"
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
          />

          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as Role)
            }
            className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[#055a7d]"
          >
            <option value="admin">Admin</option>
            <option value="lager">Lager</option>
          </select>

          <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-[#055a7d]"
            />
            Aktiv bruker
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700 disabled:opacity-50"
          >
            Avbryt
          </button>

          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-2xl bg-[#055a7d] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Oppretter..." : "Opprett"}
          </button>
          
        </div>
      </div>
    </div>
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

function UserNameEditor({
  userId,
  initialValue,
  email,
}: {
  userId: string;
  initialValue: string;
  email: string | null;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;

    setSaving(true);

    try {
      const res = await fetch("/api/admin/users/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          displayName: value.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Kunne ikke lagre navn");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kunne ikke lagre navn";

      alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Visningsnavn"
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-950 outline-none focus:border-[#055a7d]"
        />

        <button
          onClick={save}
          disabled={saving}
          className="shrink-0 rounded-xl bg-[#055a7d] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "..." : "Lagre"}
        </button>
      </div>

      <p className="text-sm text-neutral-500">
        {email}
      </p>
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
