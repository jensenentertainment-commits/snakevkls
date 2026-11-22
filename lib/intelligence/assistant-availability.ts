// Product switch: reactivation requires an explicit reviewed release.
export const AI_ASSISTANTS_ENABLED: boolean = false;
export const ASSISTANTS_DISABLED_MESSAGE = "AI-assistentene er deaktivert i Snake.";
export function assertAiAssistantsEnabled() {
  if (!AI_ASSISTANTS_ENABLED) throw new Error(ASSISTANTS_DISABLED_MESSAGE);
}
export function assistantsDisabledResponse() {
  return Response.json({ error: ASSISTANTS_DISABLED_MESSAGE, answer: ASSISTANTS_DISABLED_MESSAGE, code: "AI_ASSISTANTS_DISABLED" }, { status: 403, headers: { "Cache-Control": "no-store" } });
}
