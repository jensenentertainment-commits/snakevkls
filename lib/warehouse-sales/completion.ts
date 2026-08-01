import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  CompleteWarehouseSaleInput,
  CompleteWarehouseSaleResult,
} from "./types";

type Actor = {
  id: string;
  email: string | null;
  name: string;
};

export class WarehouseSaleCompletionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "IDEMPOTENCY_CONFLICT"
      | "INSUFFICIENT_INVENTORY"
      | "INVALID_SALE"
      | "SHOPIFY_NOT_READY"
      | "INTERNAL"
  ) {
    super(message);
  }
}

function classifyDatabaseError(message: string): WarehouseSaleCompletionError {
  if (message.includes("idempotency key reuse conflict")) {
    return new WarehouseSaleCompletionError(
      "Idempotensnøkkelen er allerede brukt til et annet salg",
      "IDEMPOTENCY_CONFLICT"
    );
  }

  if (message.includes("Insufficient inventory")) {
    return new WarehouseSaleCompletionError(
      "Ikke nok fysisk lagerbeholdning",
      "INSUFFICIENT_INVENTORY"
    );
  }

  if (
    message.includes("Shopify inventory location is not configured") ||
    message.includes("missing write_inventory")
  ) {
    return new WarehouseSaleCompletionError(
      "Shopify-lagerkoblingen er ikke klar",
      "SHOPIFY_NOT_READY"
    );
  }

  if (
    message.includes("invalid") ||
    message.includes("unknown product") ||
    message.includes("not sellable") ||
    message.includes("duplicate products") ||
    message.includes("not authorized")
  ) {
    return new WarehouseSaleCompletionError(
      "Lagersalget inneholder ugyldige data",
      "INVALID_SALE"
    );
  }

  return new WarehouseSaleCompletionError(
    "Kunne ikke fullføre lagersalget",
    "INTERNAL"
  );
}

export async function completeWarehouseSale(
  input: CompleteWarehouseSaleInput,
  actor: Actor,
  shop: string
): Promise<CompleteWarehouseSaleResult> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc(
    "complete_warehouse_sale",
    {
      requested_idempotency_key: input.idempotencyKey,
      requested_request_hash: input.requestHash,
      requested_payment_method: input.paymentMethod,
      requested_lines: input.lines,
      requested_shop: shop,
      requested_actor_id: actor.id,
      requested_actor_email: actor.email,
      requested_actor_name: actor.name,
    }
  );

  if (error) {
    throw classifyDatabaseError(error.message);
  }

  if (!data || typeof data !== "object") {
    throw new WarehouseSaleCompletionError(
      "Databasen returnerte et ugyldig salg",
      "INTERNAL"
    );
  }

  return data as CompleteWarehouseSaleResult;
}
