"use client";

import { useEffect, useRef, useState } from "react";
import { A4_GAP, A4_MARGIN, a4Layout, splitLabelSheets } from "@/lib/labels/a4";

type Label = { id: string; code: string; qr: string; printKey: string };

export function A4Preview({ labels, width, height, selected, onSelect }: {
  labels: Label[]; width: number; height: number; selected: string[]; onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(700);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const layout = a4Layout(width, height);
  const sheets = splitLabelSheets(labels, layout?.capacity ?? 0);
  const current = Math.min(page, Math.max(0, sheets.length - 1));
  const scale = layout ? Math.min(1, available / (layout.pageWidth * 96 / 25.4)) * zoom : 1;
  const qrSize = Math.min(28, height - 8, width * 0.38);
  return <div ref={host} className="min-w-0">
    {layout && <>
      <div className="no-print mb-3 flex flex-wrap items-center gap-3 text-sm">
        <p aria-live="polite">{layout.orientation === "portrait" ? "Stående" : "Liggende"} A4 · {layout.columns} × {layout.rows} = {layout.capacity} etiketter per ark · {labels.length} etiketter · {sheets.length} ark</p>
        <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Forrige ark</button>
        <span>Ark {sheets.length ? current + 1 : 0} av {sheets.length}</span>
        <button type="button" disabled={current >= sheets.length - 1} onClick={() => setPage(current + 1)}>Neste ark</button>
        <label>Zoom <select value={zoom} onChange={e => setZoom(Number(e.target.value))}>
          <option value={1}>Tilpass</option><option value={1.5}>150 %</option><option value={2}>200 %</option>
        </select></label>
      </div>
      <div className="a4-viewport overflow-auto">
        {sheets.map((sheet, index) => <div key={index} className="a4-sheet-frame" data-visible={index === current} style={{ width: layout.pageWidth * 96 / 25.4 * scale, height: layout.pageHeight * 96 / 25.4 * scale }}>
          <section aria-label={`A4-ark ${index + 1}`} className="a4-sheet" style={{ width: `${layout.pageWidth}mm`, height: `${layout.pageHeight}mm`, padding: `${A4_MARGIN}mm`, gap: `${A4_GAP}mm`, gridTemplateColumns: `repeat(${layout.columns}, ${width}mm)`, gridAutoRows: `${height}mm`, transform: `scale(${scale})` }}>
            {sheet.map(label => <article key={label.printKey} className="a4-label" style={{ width: `${width}mm`, height: `${height}mm` }}>
              <input type="checkbox" className="no-print absolute left-1 top-1" aria-label={`Velg ${label.code}`} checked={selected.includes(label.id)} onChange={() => onSelect(label.id)} />
              <strong style={{ fontSize: `${Math.min(height * 0.4, (width - qrSize - 10) / (Math.max(1, label.code.length) * 0.65))}mm` }}>{label.code}</strong>
              {/* Local QR data URL; no remote image request. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={label.qr} alt={`QR-kode for ${label.code}`} style={{ width: `${qrSize}mm`, height: `${qrSize}mm` }} />
            </article>)}
          </section>
        </div>)}
      </div>
    </>}
    <style>{`
      .a4-sheet-frame { margin: 0 auto; }
      .a4-sheet-frame[data-visible="false"] { display: none; }
      .a4-sheet { display: grid; box-sizing: border-box; align-content: start; background: white; color: black; transform-origin: top left; }
      .a4-label { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 2mm; padding: 3mm; box-sizing: border-box; border: 0.2mm dashed #888; overflow: hidden; }
      .a4-label strong { min-width: 0; white-space: nowrap; line-height: 1; font-weight: 900; }
      .a4-label img { flex-shrink: 0; }
      @media print {
        @page { size: A4 ${layout?.orientation ?? "portrait"}; margin: 0; }
        .a4-viewport { overflow: visible !important; }
        .a4-sheet-frame, .a4-sheet-frame[data-visible="false"] { display: block; width: auto !important; height: auto !important; margin: 0; break-after: page; }
        .a4-sheet-frame:last-child { break-after: auto; }
        .a4-sheet { transform: none !important; break-inside: avoid; }
        .a4-label { break-inside: avoid; }
      }
    `}</style>
  </div>;
}
