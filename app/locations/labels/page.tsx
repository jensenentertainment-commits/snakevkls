"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";

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

export default function LocationLabelsPage() {
  const [labels, setLabels] = useState<LabelWithQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [copies, setCopies] = useState(1);
  const [labelSize, setLabelSize] = useState<"60x40" | "50x30">("60x40");

  const labelDimensions = {
    "60x40": { width: "60mm", height: "40mm", qr: "20mm" },
    "50x30": { width: "50mm", height: "30mm", qr: "16mm" },
  }[labelSize];

  const printable = useMemo(() => {
    if (selected.length === 0) return labels;
    return labels.filter((label) => selected.includes(label.id));
  }, [labels, selected]);

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
            width: 220,
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
    setSelected(labels.map((label) => label.id));
  }

  function clearSelection() {
    setSelected([]);
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950 print:bg-white">
      <style>{`
        :root {
          --label-width: ${labelDimensions.width};
          --label-height: ${labelDimensions.height};
          --qr-size: ${labelDimensions.qr};
        }

        @media print {
          @page {
            size: var(--label-width) var(--label-height);
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
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
            padding: 3mm !important;
          }

          .label-qr {
            width: var(--qr-size) !important;
            height: var(--qr-size) !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl px-6 py-8 print:px-0 print:py-0">
        <header className="no-print mb-8 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
                SNAKE / Labels
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Lokasjonsetiketter
              </h1>
              <p className="mt-2 text-sm text-neutral-600">
                Velg lokasjoner, antall kopier og etikettstørrelse før utskrift.
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                {selected.length === 0
                  ? `Alle ${labels.length} aktive lokasjoner printes.`
                  : `${selected.length} av ${labels.length} lokasjoner valgt.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setLabelSize("60x40")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  labelSize === "60x40"
                    ? "bg-[#055a7d] text-white"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                60 × 40
              </button>

              <button
                onClick={() => setLabelSize("50x30")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  labelSize === "50x30"
                    ? "bg-[#055a7d] text-white"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                50 × 30
              </button>

              <button
                onClick={selectAll}
                className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700"
              >
                Velg alle
              </button>

              <button
                onClick={clearSelection}
                className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700"
              >
                Fjern valg
              </button>

              <input
                type="number"
                min={1}
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value))}
                className="w-20 rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                title="Antall kopier"
              />

              <button
                onClick={() => window.print()}
                className="rounded-xl bg-[#b58a14] px-5 py-2 text-sm font-semibold text-white"
              >
                Skriv ut
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="no-print rounded-2xl bg-white p-6 text-sm text-neutral-500">
            Lager QR-koder...
          </div>
        ) : labels.length === 0 ? (
          <div className="no-print rounded-2xl bg-white p-6 text-sm text-neutral-500">
            Ingen aktive lokasjoner funnet.
          </div>
        ) : (
          <section className="label-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {printableWithCopies.map((location) => (
              <article
                key={location.printKey}
                className="label-card relative flex flex-col justify-between rounded-2xl border-2 border-neutral-900 bg-white p-4 text-center shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(location.id)}
                  onChange={() => toggleSelect(location.id)}
                  className="no-print absolute left-3 top-3 h-4 w-4"
                />

                <div>
                  <p className="truncate text-[22px] font-black leading-none tracking-tight">
                    {location.code}
                  </p>

                  <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                    {location.zones
                      ? `${location.zones.code} — ${location.zones.name}`
                      : "Uten sone"}
                  </p>
                </div>

                <div className="mx-auto flex items-center justify-center">
                  <img
                    src={location.qr}
                    alt={`QR-kode for ${location.code}`}
                    className="label-qr h-28 w-28"
                  />
                </div>

                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  SNAKE VKLS
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}