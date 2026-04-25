"use client";

import { useEffect, useState } from "react";
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

          return {
            ...location,
            qr,
          };
        })
      );

      setLabels(withQr);
      setLoading(false);
    }

    loadLabels();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950 print:bg-white">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          .no-print {
            display: none !important;
          }

          .label-grid {
            gap: 6mm !important;
          }

          .label-card {
            break-inside: avoid;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl px-6 py-8 print:px-0 print:py-0">
        <header className="no-print mb-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#055a7d]">
              SNAKE / Labels
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Lokasjonsetiketter
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Print QR-koder for aktive lokasjoner. Klipp ut og fest på hylle,
              reol eller område.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="rounded-2xl bg-[#055a7d] px-5 py-3 text-sm font-semibold text-white"
          >
            Skriv ut
          </button>
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
          <section className="label-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
            {labels.map((location) => (
              <article
                key={location.id}
                className="label-card rounded-2xl border-2 border-neutral-900 bg-white p-4 text-center shadow-sm"
              >
                <p className="text-2xl font-black tracking-tight">
                  {location.code}
                </p>

                <div className="mx-auto mt-3 flex h-36 w-36 items-center justify-center">
                  <img
                    src={location.qr}
                    alt={`QR-kode for ${location.code}`}
                    className="h-36 w-36"
                  />
                </div>

                <p className="mt-3 text-sm font-semibold text-neutral-700">
                  {location.zones
                    ? `${location.zones.code} — ${location.zones.name}`
                    : "Uten sone"}
                </p>

                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
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