"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";

type LabelFormat = "zebra" | "shipping" | "brother";

type LocationLabel = {
  id: string;
  code: string;
  active: boolean;
  zones: {
    code: string;
    name: string;
  } | null;
};

type LabelWithQr = LocationLabel & {
  qr: string;
};

function getLocationPrefix(code: string) {
  return code.match(/^([A-Z]{2}\d{2})/)?.[1] ?? code.split("-")[0];
}

export default function LocationLabelsPage() {
  const [labels, setLabels] = useState<LabelWithQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [copies, setCopies] = useState(1);
  const [labelFormat, setLabelFormat] = useState<LabelFormat>("zebra");
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [prefixFilter, setPrefixFilter] = useState("all");

const labelDimensions = {
  zebra: {
    name: "Zebra 100 × 55",
    width: "100mm",
    height: "55mm",
    pageSize: "100mm 55mm",
    qr: "20mm",
    codeMax: "20mm",
    codeWidth: 72,
    codeWidthFactor: 0.58,
  },
  shipping: {
    name: "Fraktetikett 102 × 109",
    width: "109mm",
    height: "102mm",
    pageSize: "109mm 102mm",
    qr: "23mm",
    codeMax: "28mm",
    codeWidth: 103,
    codeWidthFactor: 0.56,
  },
  brother: {
    name: "Brother DK-22246 103 mm",
    width: "103mm",
    height: "70mm",
    pageSize: "103mm 70mm",
    qr: "21mm",
    codeMax: "22mm",
    codeWidth: 74,
    codeWidthFactor: 0.58,
  },
}[labelFormat];

  const zoneOptions = useMemo(() => {
    const zones = new Map<string, string>();

    for (const label of labels) {
      if (label.zones) zones.set(label.zones.code, label.zones.name);
    }

    return Array.from(zones, ([code, name]) => ({ code, name })).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }, [labels]);

  const prefixOptions = useMemo(() => {
    const prefixes = labels
      .filter((label) => zoneFilter === "all" || label.zones?.code === zoneFilter)
      .map((label) => getLocationPrefix(label.code));

    return Array.from(new Set(prefixes)).sort((a, b) => a.localeCompare(b));
  }, [labels, zoneFilter]);

  const filteredLabels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return labels.filter((label) => {
      if (normalizedQuery && !label.code.toLowerCase().includes(normalizedQuery)) {
        return false;
      }
      if (zoneFilter !== "all" && label.zones?.code !== zoneFilter) return false;
      if (prefixFilter !== "all" && getLocationPrefix(label.code) !== prefixFilter) {
        return false;
      }
      return true;
    });
  }, [labels, prefixFilter, query, zoneFilter]);

  const printable = useMemo(() => {
    if (selected.length === 0) return filteredLabels;
    return filteredLabels.filter((label) => selected.includes(label.id));
  }, [filteredLabels, selected]);

  const printableWithCopies = useMemo(() => {
    return printable.flatMap((label) =>
      Array.from({ length: Math.max(1, copies) }, (_, index) => ({
        ...label,
        printKey: `${label.id}-${index}`,
      }))
    );
  }, [printable, copies]);

  useEffect(() => {
    async function loadLabels() {
      setLoading(true);

      const { data, error } = await supabase
        .from("locations")
        .select(`
          id,
          code,
          active,
          zones (
            code,
            name
          )
        `)
        .eq("active", true)
        .order("code", { ascending: true });

      if (error) {
        console.error("Feil ved henting av labels:", error);
        setLabels([]);
        setLoading(false);
        return;
      }

      const origin = window.location.origin;

      const withQr = await Promise.all(
        ((data as unknown as LocationLabel[]) ?? []).map(async (location) => {
          const url = `${origin}/locations/${encodeURIComponent(location.code)}`;

          const qr = await QRCode.toDataURL(url, {
            width: 360,
            margin: 1,
          });

          return { ...location, qr };
        })
      );

      setLabels(withQr);
      setLoading(false);
    }

    loadLabels();
  }, []);

  function toggleSelect(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function selectAll() {
    setSelected(filteredLabels.map((label) => label.id));
  }

  function clearSelection() {
    setSelected([]);
  }

  function resetFilters() {
    setQuery("");
    setZoneFilter("all");
    setPrefixFilter("all");
    setSelected([]);
  }

  return (
    <>
      <div className="bg-snake-neutral-surface text-snake-text-primary print:bg-snake-surface">
      <style>{`
  :root {
    --label-width: ${labelDimensions.width};
    --label-height: ${labelDimensions.height};
    --qr-size: ${labelDimensions.qr};
    --code-max: ${labelDimensions.codeMax};
  }

  .label-card {
    width: var(--label-width);
    height: var(--label-height);
  }

  .label-qr {
    width: var(--qr-size);
    height: var(--qr-size);
  }

  .label-content {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 2mm;
  }

  .label-code-frame {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
  }

  .label-code {
    max-width: 100%;
    font-size: min(var(--code-max), var(--code-fit));
    line-height: 0.86;
    white-space: nowrap;
  }

  .label-card[data-label-format="shipping"] .label-content {
    flex-direction: column;
    align-items: stretch;
    gap: 1.5mm;
  }

  .label-card[data-label-format="shipping"] .label-code-frame {
    width: 100%;
    justify-content: center;
    text-align: center;
  }

  .label-card[data-label-format="shipping"] .label-qr {
    align-self: flex-end;
  }

  
@media print {
  .preview-scroll {
    height: auto !important;
    overflow: visible !important;
    padding: 0 !important;
    background: white !important;
  }
}
        @media print {
          @page {
            size: ${labelDimensions.pageSize};
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
          }

          .no-print {
            display: none !important;
          }

          .label-grid {
            display: block !important;
          }

          .label-card {
            width: var(--label-width) !important;
            height: var(--label-height) !important;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            box-sizing: border-box !important;
            overflow: hidden !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
            padding: 3mm !important;
          }

          .label-qr {
            width: var(--qr-size) !important;
            height: var(--qr-size) !important;
          }

          .label-code {
            line-height: 0.92 !important;
            white-space: nowrap !important;
          }
        }
      `}</style>

      <div>
        <header className="no-print sticky top-4 z-10 mb-8 rounded-snake-card bg-snake-surface/95 p-6 shadow-snake-card backdrop-blur">
          <Link
            href="/locations"
            className="mb-5 inline-flex text-sm font-semibold text-snake-link hover:underline"
          >
            ← Tilbake til lokasjoner
          </Link>

          <div className="grid gap-5 lg:grid-cols-[1fr_760px] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-snake-link">
                SNAKE / Labels
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Lokasjonsetiketter
              </h1>

              <p className="mt-2 text-sm text-snake-text-secondary">
                Velg format, lokasjoner og antall kopier før utskrift.
              </p>

              <p className="mt-2 text-xs text-snake-text-muted">
                Format: {labelDimensions.name}.{" "}
                {selected.length === 0
                  ? `${filteredLabels.length} av ${labels.length} aktive lokasjoner vises og printes.`
                  : `${printable.length} av ${filteredLabels.length} synlige lokasjoner valgt.`}
              </p>
            </div>

            <div className="flex min-h-[92px] flex-wrap content-start justify-start gap-2 lg:justify-end">
              <button
                onClick={() => setLabelFormat("zebra")}
                className={`rounded-snake-control px-4 py-2 text-sm font-semibold ${
                  labelFormat === "zebra"
                    ? "bg-snake-primary text-snake-text-on-dark"
                    : "bg-snake-neutral-surface text-snake-text-secondary"
                }`}
              >
                Zebra 100×55
              </button>

              <button
                onClick={() => setLabelFormat("shipping")}
                className={`rounded-snake-control px-4 py-2 text-sm font-semibold ${
                  labelFormat === "shipping"
                    ? "bg-snake-primary text-snake-text-on-dark"
                    : "bg-snake-neutral-surface text-snake-text-secondary"
                }`}
              >
                Frakt 102×109
              </button>

              <button
                onClick={() => setLabelFormat("brother")}
                className={`rounded-snake-control px-4 py-2 text-sm font-semibold ${
                  labelFormat === "brother"
                    ? "bg-snake-primary text-snake-text-on-dark"
                    : "bg-snake-neutral-surface text-snake-text-secondary"
                }`}
              >
                Brother 103
              </button>

              <button
                onClick={selectAll}
                className="rounded-snake-control bg-snake-neutral-surface px-4 py-2 text-sm font-semibold text-snake-text-secondary"
              >
                Velg alle i visningen
              </button>

              <button
                onClick={clearSelection}
                className="rounded-snake-control bg-snake-neutral-surface px-4 py-2 text-sm font-semibold text-snake-text-secondary"
              >
                Fjern valg
              </button>

              <input
                type="number"
                min={1}
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value))}
                className="w-20 rounded-snake-control border border-snake-border-strong px-3 py-2 text-sm"
                title="Antall kopier"
              />

              <button
                onClick={() => window.print()}
                disabled={labels.length === 0}
                className="rounded-snake-control bg-snake-brand px-5 py-2 text-sm font-semibold text-snake-text-on-dark disabled:opacity-40"
              >
                {selected.length === 0
                  ? `Skriv ut visning (${filteredLabels.length} × ${copies})`
                  : `Skriv ut valgte (${printable.length} × ${copies})`}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søk etter lokasjonskode"
              aria-label="Søk etter lokasjonskode"
              className="rounded-snake-control border border-snake-border-strong bg-snake-surface px-3 py-2 text-sm"
            />

            <select
              value={zoneFilter}
              onChange={(event) => {
                setZoneFilter(event.target.value);
                setPrefixFilter("all");
              }}
              aria-label="Filtrer på sone"
              className="rounded-snake-control border border-snake-border-strong bg-snake-surface px-3 py-2 text-sm"
            >
              <option value="all">Alle soner</option>
              {zoneOptions.map((zone) => (
                <option key={zone.code} value={zone.code}>
                  {zone.code} — {zone.name}
                </option>
              ))}
            </select>

            <select
              value={prefixFilter}
              onChange={(event) => setPrefixFilter(event.target.value)}
              aria-label="Filtrer på reol eller prefix"
              className="rounded-snake-control border border-snake-border-strong bg-snake-surface px-3 py-2 text-sm"
            >
              <option value="all">Alle reoler/prefix</option>
              {prefixOptions.map((prefix) => (
                <option key={prefix} value={prefix}>
                  {prefix}
                </option>
              ))}
            </select>

            <button
              onClick={resetFilters}
              className="rounded-snake-control bg-snake-neutral-surface px-4 py-2 text-sm font-semibold text-snake-text-secondary"
            >
              Vis alle
            </button>
          </div>
        </header>

        {loading ? (
          <div className="no-print rounded-snake-action bg-snake-surface p-6 text-sm text-snake-text-muted">
            Lager QR-koder...
          </div>
        ) : labels.length === 0 ? (
          <div className="no-print rounded-snake-action bg-snake-surface p-6 text-sm text-snake-text-muted">
            Ingen aktive lokasjoner funnet.
          </div>
        ) : printableWithCopies.length === 0 ? (
          <div className="no-print rounded-snake-action bg-snake-surface p-6 text-sm text-snake-text-muted">
            Ingen lokasjoner matcher søket eller filtrene.
          </div>
        ) : (
          <div className="h-[620px] overflow-y-auto rounded-snake-card bg-snake-neutral-surface p-4">
          <section className="label-grid grid min-h-[520px] grid-cols-1 content-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {printableWithCopies.map((location) => {
              return (
                <article
                  key={location.printKey}
                  data-label-format={labelFormat}
                  className="label-card relative rounded-snake-action border-2 border-snake-text-primary bg-snake-surface p-4 text-center shadow-snake-card"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(location.id)}
                    onChange={() => toggleSelect(location.id)}
                    className="no-print absolute left-3 top-3 h-4 w-4"
                  />

  <div className="label-content">
    <div className="label-code-frame">
      <p
        className="label-code font-black tracking-[-0.045em]"
        style={{
          "--code-fit": `${
            labelDimensions.codeWidth /
            (location.code.length * labelDimensions.codeWidthFactor)
          }mm`,
        } as CSSProperties}
      >
        {location.code}
      </p>
    </div>

    <img
      src={location.qr}
      alt={`QR-kode for ${location.code}`}
      className="label-qr shrink-0"
    />
  </div>
                </article>
              );
            })}
          </section>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
