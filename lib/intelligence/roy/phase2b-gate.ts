import 'server-only';
export function royPhase2bEnabled() { return process.env.ROY_PHASE2B_ENABLED === 'true'; }
