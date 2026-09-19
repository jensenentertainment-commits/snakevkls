import "server-only";

// Commit 7 is shipped inactive. Enabling requires separate database validation
// and production approval; never infer readiness from RPC availability.
export function royPhase2aEnabled(): boolean {
  return process.env.ROY_PHASE2A_ENABLED === "true";
}
