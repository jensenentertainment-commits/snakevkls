import type {
  ShopifyInventoryAdjustmentResult,
  ShopifyWorkerFailureKind,
  WarehouseSaleShopifyClaim,
} from "./shopify-worker-types.ts";

export const SHOPIFY_INVENTORY_ADJUST_MUTATION = `
  mutation WarehouseSaleInventoryAdjust(
    $input: InventoryAdjustQuantitiesInput!
    $idempotencyKey: String!
  ) {
    inventoryAdjustQuantities(input: $input)
      @idempotent(key: $idempotencyKey) {
      inventoryAdjustmentGroup {
        createdAt
        referenceDocumentUri
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const TRANSIENT_USER_ERROR_CODES = new Set([
  "ADJUST_QUANTITIES_FAILED",
  "IDEMPOTENCY_CONCURRENT_REQUEST",
  "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
  "SERVICE_UNAVAILABLE",
]);

export class ShopifyInventoryWorkerError extends Error {
  readonly code: string;
  readonly kind: ShopifyWorkerFailureKind;

  constructor(
    message: string,
    code: string,
    kind: ShopifyWorkerFailureKind
  ) {
    super(message);
    this.name = "ShopifyInventoryWorkerError";
    this.code = code;
    this.kind = kind;
  }
}

type ShopifyResponse = {
  data?: {
    inventoryAdjustQuantities?: {
      inventoryAdjustmentGroup?: {
        createdAt?: string;
        referenceDocumentUri?: string;
      } | null;
      userErrors?: Array<{ code?: string; message: string }>;
    };
  };
  errors?: Array<{ message: string }>;
};

export async function adjustShopifyInventoryForWarehouseSale({
  claim,
  accessToken,
  apiVersion = "2026-04",
  timeoutMs = 15_000,
  fetchImpl = fetch,
}: {
  claim: Extract<WarehouseSaleShopifyClaim, { acquired: true }>;
  accessToken: string;
  apiVersion?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ShopifyInventoryAdjustmentResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const variables = {
    idempotencyKey: claim.idempotencyKey,
    input: {
      reason: "correction",
      name: "available",
      referenceDocumentUri: claim.referenceDocumentUri,
      changes: claim.payload.changes.map((change) => ({
        delta: change.delta,
        changeFromQuantity: null,
        inventoryItemId: change.inventoryItemId,
        locationId: claim.shopifyLocationId,
      })),
    },
  };

  let response: Response;
  try {
    response = await fetchImpl(
      `https://${claim.shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: SHOPIFY_INVENTORY_ADJUST_MUTATION,
          variables,
        }),
        signal: controller.signal,
      }
    );
  } catch (error) {
    const timeoutOrNetwork =
      error instanceof Error && error.name === "AbortError"
        ? ["TIMEOUT_UNKNOWN", "Shopify-kallet tidsavbrøt med ukjent resultat"]
        : ["NETWORK_UNKNOWN", "Shopify-kallet feilet med ukjent resultat"];
    throw new ShopifyInventoryWorkerError(
      timeoutOrNetwork[1],
      timeoutOrNetwork[0],
      "unknown"
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429 || response.status >= 500) {
    throw new ShopifyInventoryWorkerError(
      `Shopify svarte med HTTP ${response.status}`,
      `HTTP_${response.status}`,
      "transient"
    );
  }
  if (!response.ok) {
    throw new ShopifyInventoryWorkerError(
      `Shopify avviste kallet med HTTP ${response.status}`,
      `HTTP_${response.status}`,
      "permanent"
    );
  }

  let body: ShopifyResponse;
  try {
    body = (await response.json()) as ShopifyResponse;
  } catch {
    throw new ShopifyInventoryWorkerError(
      "Shopify returnerte et uleselig svar",
      "INVALID_RESPONSE_UNKNOWN",
      "unknown"
    );
  }

  if (body.errors?.length) {
    throw new ShopifyInventoryWorkerError(
      body.errors.map((error) => error.message).join("; "),
      "GRAPHQL_ERROR",
      "transient"
    );
  }

  const payload = body.data?.inventoryAdjustQuantities;
  const userError = payload?.userErrors?.[0];
  if (userError) {
    const code = userError.code ?? "SHOPIFY_USER_ERROR";
    throw new ShopifyInventoryWorkerError(
      userError.message,
      code,
      TRANSIENT_USER_ERROR_CODES.has(code) ? "transient" : "permanent"
    );
  }

  const group = payload?.inventoryAdjustmentGroup;
  if (!group?.referenceDocumentUri || !group.createdAt) {
    throw new ShopifyInventoryWorkerError(
      "Shopify-svaret mangler bekreftelse på lagerjusteringen",
      "MISSING_CONFIRMATION_UNKNOWN",
      "unknown"
    );
  }

  return {
    adjustmentGroupId: `${group.referenceDocumentUri}#${group.createdAt}`,
  };
}
