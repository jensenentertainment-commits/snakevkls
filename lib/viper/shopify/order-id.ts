const ORDER_GID_PREFIX = "gid://shopify/Order/";

export function normalizeShopifyOrderId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();

  if (/^\d{1,20}$/.test(trimmed)) {
    return `${ORDER_GID_PREFIX}${trimmed}`;
  }

  if (
    trimmed.startsWith(ORDER_GID_PREFIX) &&
    /^\d{1,20}$/.test(trimmed.slice(ORDER_GID_PREFIX.length))
  ) {
    return trimmed;
  }

  return null;
}
