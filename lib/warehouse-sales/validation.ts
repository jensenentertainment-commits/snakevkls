import { createHash } from "node:crypto";
import type {
  CompleteWarehouseSaleInput,
  CompleteWarehouseSaleLineInput,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_LINES = 100;
const MAX_QUANTITY = 2_147_483_647;

export class WarehouseSaleValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLine(
  value: unknown,
  index: number
): CompleteWarehouseSaleLineInput {
  if (!isRecord(value)) {
    throw new WarehouseSaleValidationError(`Ugyldig varelinje ${index + 1}`);
  }

  const productId = String(value.productId ?? "").trim().toLowerCase();
  const quantity = Number(value.quantity);
  const unitPriceMinor = Number(value.unitPriceMinor);

  if (!UUID_PATTERN.test(productId)) {
    throw new WarehouseSaleValidationError(
      `Ugyldig produkt på varelinje ${index + 1}`
    );
  }

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY
  ) {
    throw new WarehouseSaleValidationError(
      `Ugyldig antall på varelinje ${index + 1}`
    );
  }

  if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new WarehouseSaleValidationError(
      `Ugyldig pris på varelinje ${index + 1}`
    );
  }

  return { productId, quantity, unitPriceMinor };
}

export function normalizeWarehouseSaleLines(
  value: unknown,
): CompleteWarehouseSaleLineInput[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_LINES
  ) {
    throw new WarehouseSaleValidationError(
      "Lagersalget må ha mellom 1 og 100 varelinjer",
    );
  }

  const lines = value
    .map(normalizeLine)
    .sort((left, right) => left.productId.localeCompare(right.productId));
  const uniqueProductIds = new Set(lines.map((line) => line.productId));
  if (uniqueProductIds.size !== lines.length) {
    throw new WarehouseSaleValidationError(
      "Samme produkt kan bare forekomme én gang",
    );
  }
  return lines;
}

export function normalizeWarehouseSaleRequest(
  value: unknown
): CompleteWarehouseSaleInput {
  if (!isRecord(value)) {
    throw new WarehouseSaleValidationError("Ugyldig lagersalg");
  }

  const idempotencyKey = String(value.idempotencyKey ?? "")
    .trim()
    .toLowerCase();
  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw new WarehouseSaleValidationError("Ugyldig idempotensnøkkel");
  }

  const paymentMethod = value.paymentMethod;
  if (paymentMethod !== "vipps" && paymentMethod !== "cash") {
    throw new WarehouseSaleValidationError("Ugyldig betalingsmåte");
  }

  const lines = normalizeWarehouseSaleLines(value.lines);

  const canonicalRequest = JSON.stringify({
    paymentMethod,
    lines,
  });
  const requestHash = createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");

  return {
    idempotencyKey,
    paymentMethod,
    lines,
    requestHash,
  };
}
