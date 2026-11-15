"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, MapPin, Search } from "lucide-react";
import { LagerHero } from "../components/lager/LagerHero";
import { supabase } from "@/lib/supabase";
import { canCompleteCount, isSavedCount, type CountSession, type CountLine } from "@/lib/inventory/count-session";

type LocationRow = { id: string; code: string; active: boolean; zones: { code: string; name: string } | null };
const actionClass = "rounded-snake-action bg-snake-primary px-4 py-3 text-sm font-semibold text-snake-text-on-dark disabled:cursor-not-allowed disabled:opacity-50";

export default function LocationCountPage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [session, setSession] = useState<CountSession | null>(null);
  const [requiresReload, setRequiresReload] = useState(false);
  const commandInFlight = useRef(false);
  const requestSequence = useRef(0);
  const selectedLocation = locations.find(l => l.id === selectedLocationId) ?? null;
  const dirty = (session?.lines ?? []).some(line => line.saved_at
    ? !isSavedCount(line, counts[line.inventory_id], notes[line.inventory_id])
    : !!counts[line.inventory_id] || !!notes[line.inventory_id]);
  const saved = (session?.lines ?? []).filter(line => isSavedCount(line, counts[line.inventory_id], notes[line.inventory_id]));
  const differences = saved.filter(line => line.counted_quantity !== line.expected_quantity).length;
  const completed = session?.status === "completed";
  const filteredLocations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return locations.filter(l => l.active && (!term || l.code.toLowerCase().includes(term) ||
      l.zones?.code.toLowerCase().includes(term) || l.zones?.name.toLowerCase().includes(term)));
  }, [locations, search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Page through all locations; never silently truncate the counting picker.
      const rows: LocationRow[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await supabase.from("locations")
          .select("id,code,active,zones(code,name)").eq("active", true).order("code").order("id").range(from, from + 499);
        if (cancelled) return;
        if (error) { setMessage("Kunne ikke hente lokasjoner."); setLoading(false); return; }
        rows.push(...(data as unknown as LocationRow[]));
        if (data.length < 500) break;
      }
      if (!cancelled) { setLocations(rows); setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  function acceptSession(next: CountSession | null, resetDrafts = true) {
    setSession(next);
    if (resetDrafts) {
      setCounts(Object.fromEntries((next?.lines ?? []).map(l => [l.inventory_id, l.counted_quantity === null ? "" : String(l.counted_quantity)])));
      setNotes(Object.fromEntries((next?.lines ?? []).map(l => [l.inventory_id, l.note ?? ""])));
    }
  }

  async function openLocation(locationId: string) {
    if (commandInFlight.current) return;
    if (dirty && !window.confirm("Ulagrede endringer blir forkastet. Fortsette?")) return;
    const sequence = ++requestSequence.current;
    setSelectedLocationId(locationId); setBusy(true); setMessage(null); setRequiresReload(true); acceptSession(null);
    try {
      const response = await fetch(`/api/location-count/session?locationId=${encodeURIComponent(locationId)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Kunne ikke hente telling.");
      if (sequence !== requestSequence.current) return;
      acceptSession(json.session); setRequiresReload(false);
    } catch (error) {
      if (sequence === requestSequence.current) setMessage(error instanceof Error ? error.message : "Kunne ikke hente telling.");
    } finally { if (sequence === requestSequence.current) setBusy(false); }
  }

  async function command(action: "start" | "restart" | "save" | "complete", line?: CountLine) {
    if (!selectedLocation || busy || requiresReload || commandInFlight.current) return;
    if (action === "complete" && !canCompleteCount(session, counts, notes, busy)) return;
    if (action === "restart" && !window.confirm("Avslutte denne økten og telle på nytt? Lagret historikk beholdes, men alle linjer må telles på nytt.")) return;
    const raw = line ? counts[line.inventory_id] : undefined;
    if (action === "save" && (raw === undefined || raw.trim() === "" || !Number.isSafeInteger(Number(raw)) || Number(raw) < 0)) {
      setMessage("Registrer et helt antall på minst 0."); return;
    }
    commandInFlight.current = true; setBusy(true); setMessage(null);
    try {
      const path = action === "save" ? "" : action === "complete" ? "/complete" : "/session";
      const response = await fetch(`/api/location-count${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, locationId: selectedLocation.id, sessionId: session?.id, version: session?.version,
          ...(line ? { inventoryId: line.inventory_id, countedQuantity: Number(raw), note: notes[line.inventory_id] ?? null } : {}) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Kunne ikke behandle tellingen.");
      acceptSession(json.session, action !== "save");
      setMessage(action === "complete" ? "Tellingen er fullført og dokumentert. Beholdningen er ikke endret."
        : action === "save" ? "Tellelinjen er lagret. Beholdningen er ikke endret." : "Telleøkten er klar. Lagre hver linje når den er telt.");
    } catch (error) {
      setRequiresReload(true); setMessage(error instanceof Error ? error.message : "Kunne ikke behandle tellingen.");
    } finally { commandInFlight.current = false; setBusy(false); }
  }

  return (
    <section className="overflow-hidden rounded-snake-panel bg-snake-workspace text-snake-text-primary shadow-snake-overlay">
      <LagerHero eyebrow="Snake / Lokasjonstelling" title="Tell lokasjon"
        description="Velg en lokasjon, tell fysisk antall og lagre resultatet som kontrollhistorikk. Telling endrer ikke lagerantall automatisk."
        backHref="/" backLabel="Tilbake til dashboard" />
      <div className="grid gap-5 px-5 py-7 sm:px-8 sm:py-8 lg:grid-cols-[380px_1fr]">
        <aside className="rounded-snake-card border border-snake-border-subtle bg-snake-surface p-5 shadow-snake-card">
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 text-snake-link" />
            <div><h2 className="text-lg font-semibold">Velg lokasjon</h2><p className="text-sm text-snake-text-muted">Søk etter kode eller sone.</p></div>
          </div>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-snake-text-disabled" />
            <input aria-label="Søk lokasjon" value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk lokasjon..."
              className="w-full rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle py-3 pl-11 pr-4 text-sm" />
          </div>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {loading ? <p>Henter lokasjoner...</p> : filteredLocations.length === 0 ? <p>Ingen lokasjoner funnet.</p> : filteredLocations.map(location => (
              <button key={location.id} type="button" disabled={busy} onClick={() => void openLocation(location.id)}
                className={`w-full rounded-snake-action border px-4 py-3 text-left transition disabled:opacity-50 ${selectedLocationId === location.id ? "border-snake-primary bg-snake-primary/10" : "border-snake-border-subtle bg-snake-surface-subtle hover:border-snake-primary/40"}`}>
                <span className="block text-sm font-semibold">{location.code}</span>
                <span className="mt-0.5 block text-xs text-snake-text-muted">{location.zones?.code ?? "Uten sone"}{location.zones?.name ? ` — ${location.zones.name}` : ""}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="min-w-0 rounded-snake-card border border-snake-border-subtle bg-snake-surface p-5 shadow-snake-card">
          {!selectedLocation ? <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 text-center">
            <ClipboardCheck className="h-9 w-9 text-snake-text-disabled" /><h2 className="text-xl font-semibold">Velg en lokasjon</h2>
            <p className="text-sm text-snake-text-muted">Åpne en lokasjon for å starte eller gjenoppta en lagret telling.</p>
          </div> : busy && !session ? <p role="status">Henter telling...</p> : !session ? <div className="space-y-3">
            <h2 className="text-lg font-semibold">{selectedLocation.code}</h2>
            <p>Start en telling for å lagre fremdrift. Tellingen endrer ikke beholdningen.</p>
            <button type="button" className={actionClass} disabled={busy || requiresReload} onClick={() => void command("start")}>Start telling</button>
          </div> : <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{session.location_code}</h2>
              <span className="text-sm">{completed ? "Fullført" : "Pågår"}</span>
              <button type="button" disabled={busy} onClick={() => void openLocation(selectedLocation.id)} className="text-sm underline">Last inn lagret økt</button>
              <button type="button" disabled={busy || requiresReload} onClick={() => void command(session.status === "active" ? "restart" : "start")} className="text-sm underline">Start ny telling</button>
            </div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{saved.length} / {session.lines.length} linjer lagret</p>
                <p className="text-sm text-snake-text-secondary">{differences} telleforskjeller registrert. Beholdningen endres ikke.</p>
                {dirty && <p className="text-sm text-snake-warning">Du har ulagrede endringer.</p>}
              </div>
              <button type="button" className={actionClass} disabled={requiresReload || !canCompleteCount(session, counts, notes, busy)} onClick={() => void command("complete")}>
                {completed ? "Fullført" : busy ? "Behandler..." : "Fullfør telling"}
              </button>
            </div>
            {session.lines.length === 0 && <p className="mb-4 text-sm">Ingen lagerposter i tellegrunnlaget. Kontroller fysisk at lokasjonen er tom før du fullfører.</p>}
            <div className="space-y-3">{session.lines.map(line => {
              const lineSaved = isSavedCount(line, counts[line.inventory_id], notes[line.inventory_id]);
              const value = counts[line.inventory_id];
              const difference = value !== undefined && value.trim() !== "" && Number.isInteger(Number(value)) ? Number(value) - line.expected_quantity : null;
              return <article key={line.inventory_id} className="rounded-snake-card border border-snake-border-subtle bg-snake-surface-subtle p-4">
                <p className="text-xs font-semibold uppercase text-snake-text-muted">{line.sku ?? "Ingen SKU"}</p>
                <h3 className="mt-1 text-lg font-semibold">{line.product_name}</h3>
                {line.variant_name && <p className="text-sm text-snake-text-muted">{line.variant_name}</p>}
                <p className="my-3 text-sm">Forventet: {line.expected_quantity}{difference !== null && ` · Telleforskjell: ${difference > 0 ? "+" : ""}${difference}${lineSaved ? " (lagret)" : " (ikke lagret)"}`}</p>
                <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                  <input type="number" min="0" step="1" aria-label={`Telt antall for ${line.product_name}`} value={value ?? ""}
                    disabled={busy || requiresReload || completed} onChange={e => setCounts(prev => ({ ...prev, [line.inventory_id]: e.target.value }))} placeholder="Telt"
                    className="min-w-0 rounded-snake-action border border-snake-border-subtle bg-snake-surface px-4 py-3 text-sm" />
                  <input aria-label={`Notat for ${line.product_name}`} maxLength={2000} value={notes[line.inventory_id] ?? ""}
                    disabled={busy || requiresReload || completed} onChange={e => setNotes(prev => ({ ...prev, [line.inventory_id]: e.target.value }))} placeholder="Notat, valgfritt"
                    className="min-w-0 rounded-snake-action border border-snake-border-subtle bg-snake-surface px-4 py-3 text-sm" />
                  <button type="button" className={`${actionClass} inline-flex items-center justify-center gap-2`} disabled={busy || requiresReload || completed || lineSaved} onClick={() => void command("save", line)}>
                    {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{lineSaved ? "Lagret" : "Lagre"}
                  </button>
                </div>
              </article>;
            })}</div>
          </>}
          {requiresReload && selectedLocation && <button type="button" disabled={busy} onClick={() => void openLocation(selectedLocation.id)} className="mt-4 text-sm underline">Last inn lagret økt før du fortsetter</button>}
          {message && <p role="status" className="mt-4 rounded-snake-action border border-snake-border-subtle bg-snake-surface-subtle p-4 text-sm">{message}</p>}
        </section>
      </div>
    </section>
  );
}
