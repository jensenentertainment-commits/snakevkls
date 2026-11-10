"use client";

import { useId, useRef, useState } from "react";
import type { LocationOption, ZoneOption } from "./types";
import { searchLocations } from "./location-search";

export function LocationPicker({ locations, zones, value, onChange }: {
  locations: LocationOption[]; zones: ZoneOption[]; value: string; onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState(() => locations.find(l => l.id === value)?.code ?? "");
  const [zone, setZone] = useState("");
  const [cursor, setCursor] = useState(-1);
  const [open, setOpen] = useState(!value);
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const matches = searchLocations(locations, query, zone);
  const selected = locations.find(l => l.id === value);
  function choose(location: LocationOption) {
    onChange(location.id); setQuery(location.code); setOpen(false); setCursor(-1);
  }
  return <div>
    <label htmlFor={`${id}-zone`} className="mt-2 block text-sm text-neutral-600">Filtrer sone</label>
    <select id={`${id}-zone`} value={zone} onChange={e => { setZone(e.target.value); setQuery(""); onChange(""); setCursor(-1); setOpen(true); }} className="my-2 w-full rounded-xl border border-neutral-300 bg-white p-3 text-sm">
      <option value="">Alle soner</option>{zones.map(z => <option key={z.id} value={z.id}>{z.code} – {z.name}</option>)}
    </select>
    <input id="placement-location" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && cursor >= 0 && matches[cursor] ? `${id}-${cursor}` : undefined}
      aria-describedby={`${id}-status`} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} value={query} placeholder="Skriv eller skann lokasjonskode"
      onFocus={() => setOpen(true)} onBlur={e => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setOpen(false); }}
      onChange={e => { setQuery(e.target.value); onChange(""); setCursor(-1); setOpen(true); }}
      onKeyDown={e => {
        if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault(); setOpen(true);
          const next = Math.max(0, Math.min(matches.length - 1, cursor + (e.key === "ArrowDown" ? 1 : -1)));
          setCursor(next); requestAnimationFrame(() => list.current?.children[next]?.scrollIntoView({ block: "nearest" }));
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const exact = matches.filter(l => l.code.toUpperCase() === query.trim().toUpperCase());
          const target = exact.length === 1 ? exact[0] : open && cursor >= 0 ? matches[cursor] : undefined;
          if (target) choose(target); else setOpen(true);
        }
      }} className="w-full rounded-xl border border-neutral-300 p-3 text-sm outline-none focus:border-[#055a7d] focus:ring-2 focus:ring-[#055a7d]/20" />
    <div className="mt-2 h-44" data-location-results>
    {open && <div ref={list} id={`${id}-list`} role="listbox" aria-label="Lokasjoner" className="h-full overflow-y-auto overscroll-contain rounded-xl border border-neutral-200">
      {matches.map((l, i) => <div key={l.id} id={`${id}-${i}`} role="option" aria-selected={l.id === value} onMouseDown={e => e.preventDefault()} onClick={() => choose(l)} className={`cursor-pointer px-3 py-3 text-sm ${cursor === i ? "bg-sky-100" : "hover:bg-neutral-100"}`}>
        <span className="font-semibold">{l.code}</span><span className="ml-2 text-neutral-600">{zones.find(z => z.id === l.zone_id)?.code ?? "Ukjent sone"} · {l.location_purpose ?? "Type ikke oppgitt"}</span>
      </div>)}
    </div>}
    </div>
    <p id={`${id}-status`} role="status" className="mt-2 min-h-10 text-sm text-neutral-600">{selected ? `Valgt: ${selected.code}` : matches.length ? `${matches.length} treff. Velg et treff eller skann full kode og trykk Enter.` : "Ingen treff. Kontroller koden eller sonefilteret."}</p>
  </div>;
}
