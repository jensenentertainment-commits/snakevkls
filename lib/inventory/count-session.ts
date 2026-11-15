export type CountLine = {
  inventory_id: string; product_id: string; product_name: string;
  variant_name: string | null; sku: string | null; expected_quantity: number;
  counted_quantity: number | null; note: string | null; saved_at: string | null;
};
export type CountSession = {
  id: string; location_id: string; location_code: string;
  status: "active" | "completed" | "abandoned"; version: number; completed_at: string | null;
  lines: CountLine[];
  result: { totalLines: number; matchedLines: number; diffLines: number } | null;
};
export function isSavedCount(line: CountLine, value: string | undefined, note: string | undefined) {
  return line.saved_at !== null && line.counted_quantity !== null && value !== undefined && value.trim() !== ""
    && Number.isInteger(Number(value)) && Number(value) === line.counted_quantity
    && (note ?? "").trim() === (line.note ?? "");
}
export function canCompleteCount(session: CountSession | null, counts: Record<string, string>, notes: Record<string, string>, busy: boolean) {
  return !!session && session.status === "active" && !busy
    && session.lines.every(line => isSavedCount(line, counts[line.inventory_id], notes[line.inventory_id]));
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isCountId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
export function countCommand(body: unknown, mode: "session" | "save" | "complete") {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Ugyldig telleforespørsel.");
  const b = body as Record<string, unknown>;
  const action = mode === "session" ? b.action : mode;
  if (!isCountId(b.locationId) || !["start", "restart", "save", "complete"].includes(String(action)))
    throw new Error("Mangler gyldig lokasjon eller handling.");
  if (mode === "session" && action !== "start" && action !== "restart") throw new Error("Ugyldig økthandling.");
  if (action !== "start" && (!isCountId(b.sessionId) || !Number.isSafeInteger(b.version) || Number(b.version) < 1 || Number(b.version) > 2147483646))
    throw new Error("Last inn telleøkten på nytt før du lagrer eller fullfører.");
  if (action === "save" && (!isCountId(b.inventoryId) || !Number.isSafeInteger(b.countedQuantity) || Number(b.countedQuantity) < 0 || Number(b.countedQuantity) > 2147483647))
    throw new Error("Telt antall må være et heltall på minst 0.");
  if (b.note != null && (typeof b.note !== "string" || b.note.length > 2000)) throw new Error("Notatet er for langt eller ugyldig.");
  return {
    requested_action: action as string, requested_location_id: b.locationId,
    requested_session_id: action === "start" ? null : b.sessionId as string,
    expected_version: action === "start" ? null : b.version as number,
    requested_inventory_id: action === "save" ? b.inventoryId as string : null,
    requested_counted_quantity: action === "save" ? b.countedQuantity as number : null,
    requested_note: action === "save" ? (b.note as string | undefined)?.trim() || null : null,
  };
}
export function countError(code: string | undefined) {
  if (["40001", "55P03", "40P01", "23505"].includes(code ?? "")) return {
    status: 409, error: "Telleøkten eller lagergrunnlaget er endret eller i bruk. Last inn lagret økt. Hvis lagergrunnlaget er endret, må du starte en ny telling og telle på nytt.",
  };
  if (code === "22023") return { status: 400, error: "Tellingen kan ikke lagres eller fullføres. Kontroller lokasjon, antall og at alle linjer er lagret." };
  return { status: 500, error: "Kunne ikke behandle tellingen. Lagrede linjer er bevart. Last inn økten før du prøver igjen." };
}
