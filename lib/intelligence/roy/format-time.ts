const formatter = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Presentation only: source timestamps remain unchanged. */
export function formatRoyTime(value: string | null | undefined): string {
  if (!value || Number.isNaN(new Date(value).valueOf())) return "Ikke observert";
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}
