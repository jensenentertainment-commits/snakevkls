import "server-only";

export function isViperShopifyImportEnabled() {
  return process.env.VIPER_SHOPIFY_IMPORT_ENABLED === "true";
}
