export const actions = ['start','confirm','report','resolve','complete','undo','cancel','reprepare'] as const;
export type PickAction = typeof actions[number];
export type PickCommand = { commandId: string; expectedVersion: number; payload: Record<string, unknown> };
export function parsePickCommand(value: unknown): PickCommand | null {
 if (!value || typeof value !== 'object') return null;
 const b=value as Record<string,unknown>;
 if(typeof b.commandId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.commandId)
   || !Number.isInteger(b.expectedVersion) || Number(b.expectedVersion)<0 || Number(b.expectedVersion)>2147483646
   || !b.payload || typeof b.payload!=='object' || Array.isArray(b.payload)) return null;
 return {commandId:b.commandId,expectedVersion:Number(b.expectedVersion),payload:b.payload as Record<string,unknown>};
}
