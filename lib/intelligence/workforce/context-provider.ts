import type { CapabilityId } from "./capability";
import type { AuthorizedWorkforceContext } from "./workforce-authorization";

export type ContextProviderId = "warehouse.summary";

export type ContextProvider<TContext> = {
  readonly id: ContextProviderId;
  readonly capabilityId: CapabilityId;
  provide(context: AuthorizedWorkforceContext): Promise<TContext>;
};
