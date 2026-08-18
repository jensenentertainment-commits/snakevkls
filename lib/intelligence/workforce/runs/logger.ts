import "server-only";

import type { WorkforceRunMetadata } from "../workforce-run-metadata";

export function logWorkforceRun(metadata: WorkforceRunMetadata) {
  console.info("[workforce] run", metadata);
}
