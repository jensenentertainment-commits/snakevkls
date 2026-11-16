export const LABEL_ORIGIN = "https://snakevkls-yh9b.vercel.app";
export const A4_MARGIN = 10;
export const A4_GAP = 2;

export function locationLabelUrl(code: string) {
  return `${LABEL_ORIGIN}/locations/${encodeURIComponent(code)}`;
}

export function a4Layout(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 60 || width > 277 || height < 30 || height > 277) {
    return null;
  }
  const options = ([ [210, 297, "portrait"], [297, 210, "landscape"] ] as const).map(([pageWidth, pageHeight, orientation]) => {
    const columns = Math.floor((pageWidth - 2 * A4_MARGIN + A4_GAP) / (width + A4_GAP));
    const rows = Math.floor((pageHeight - 2 * A4_MARGIN + A4_GAP) / (height + A4_GAP));
    return { pageWidth, pageHeight, orientation, columns, rows, capacity: columns * rows };
  });
  const best = options[1].capacity > options[0].capacity ? options[1] : options[0];
  return best.capacity > 0 ? best : null;
}

export function splitLabelSheets<T>(labels: T[], capacity: number): T[][] {
  if (!Number.isInteger(capacity) || capacity < 1) return [];
  return Array.from({ length: Math.ceil(labels.length / capacity) }, (_, i) => labels.slice(i * capacity, (i + 1) * capacity));
}
