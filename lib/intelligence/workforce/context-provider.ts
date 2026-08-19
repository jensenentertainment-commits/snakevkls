import type { CapabilityId } from "./capability";
import type { ValidChatInput } from "../shared/chat-input";
import type { AuthorizedWorkforceContext } from "./workforce-authorization";

export type ContextProviderId =
  | "warehouse.summary"
  | "arne.advisory_context"
  | "shopify.catalog";

export type ContextProvider<TContext> = {
  readonly id: ContextProviderId;
  readonly capabilityId: CapabilityId;
  provide(
    context: AuthorizedWorkforceContext,
    input: ValidChatInput,
  ): Promise<TContext>;
};
