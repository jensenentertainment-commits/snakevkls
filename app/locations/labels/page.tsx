"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function LocationLabelsPage() {
  const [labels, setLabels] = useState<LabelWithQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [copies, setCopies] = useState(1);
  const [labelFormat, setLabelFormat] = useState<LabelFormat>("zebra");

const labelDimensions = {
  zebra: {
    name: "Zebra 100 × 55",
    width: "100mm",
    height: "55mm",
    qr: "24mm",
    codeSize: "35px",
    layout: "landscape",
  },
  shipping: {
    name: "Fraktetikett 102 × 109",
    width: "109mm",
    height: "102mm",
    qr: "34mm",
    codeSize: "46px",
    layout: "portrait",
  },
  brother: {
    name: "Brother DK-22246 103 mm",
    width: "103mm",
    height: "70mm",
    qr: "28mm",
    codeSize: "42px",
    layout: "portrait",
  },
}[labelFormat];

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
    setSelected(labels.map((label) => label.id));
  }

  function clearSelection() {
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
    --code-size: ${labelDimensions.codeSize};
    
  }

  .label-card {
    width: var(--label-width);
    height: var(--label-height);
  }

  .label-qr {
    width: var(--qr-size);
    height: var(--qr-size);
  }

  .label-code {
    font-size: var(--code-size);
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
            padding: 4mm !important;
          }

          .label-qr {
            width: var(--qr-size) !important;
            height: var(--qr-size) !important;
          }

          .label-code {
            font-size: var(--code-size) !important;
            .label-zone {
  font-size: var(--zone-size) !important;
}
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
                  ? `Alle ${labels.length} aktive lokasjoner printes.`
                  : `${selected.length} av ${labels.length} lokasjoner valgt.`}
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
                Velg alle
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
                  ? `Skriv ut alle (${labels.length} × ${copies})`
                  : `Skriv ut valgte (${selected.length} × ${copies})`}
              </button>
            </div>
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
        ) : (
          <div className="h-[620px] overflow-y-auto rounded-snake-card bg-snake-neutral-surface p-4">
          <section className="label-grid grid min-h-[520px] grid-cols-1 content-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {printableWithCopies.map((location) => {
              const isLandscape = labelDimensions.layout === "landscape";

              return (
                <article
                  key={location.printKey}
                  className="label-card relative rounded-snake-action border-2 border-snake-text-primary bg-snake-surface p-4 text-center shadow-snake-card"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(location.id)}
                    onChange={() => toggleSelect(location.id)}
                    className="no-print absolute left-3 top-3 h-4 w-4"
                  />

                  {isLandscape ? (
  <div className="flex h-full items-center justify-between gap-5">
    <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
      <p className="label-code whitespace-nowrap font-black leading-none tracking-tight">
        {location.code}
      </p>

      <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.24em] text-snake-text-disabled">
        SNAKE OS
      </p>
    </div>

    <img
      src={location.qr}
      alt={`QR-kode for ${location.code}`}
      className="label-qr shrink-0"
    />
  </div>

                  ) : (
       <div className="flex h-full flex-col items-center justify-between text-center">
  <p className="label-code whitespace-nowrap font-black leading-none tracking-tight">
    {location.code}
  </p>

  <img
    src={location.qr}
    alt={`QR-kode for ${location.code}`}
    className="label-qr"
  />

  <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-snake-text-disabled">
    SNAKE OS
  </p>
</div>
                  )}
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
