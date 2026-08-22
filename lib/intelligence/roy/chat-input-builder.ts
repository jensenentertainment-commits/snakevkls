import type { ValidChatInput } from "../shared/chat-input";
import type { ShopifyCatalogContext } from "../workforce/contexts/shopify-catalog";

export function buildRoyModelInput(input: {
  systemPrompt: string;
  context: ShopifyCatalogContext;
  history: ValidChatInput["history"];
  question: string;
}) {
  return [
    { role: "system" as const, content: input.systemPrompt },
    {
      role: "system" as const,
      content: `# Autoritativ mottatt katalogkontekst\n${JSON.stringify(withoutTechnicalIds(input.context))}`,
    },
    ...input.history.map((message) => ({
      role: message.role,
      content: message.text,
    })),
    { role: "user" as const, content: input.question },
  ];
}

function withoutTechnicalIds(context: ShopifyCatalogContext) {
  return {
    ...context,
    products: context.products.map((product) => ({
      sku: product.sku,
      variantName: product.variantName,
      productName: product.productName,
      vendor: product.vendor,
      productType: product.productType,
      status: product.status,
      priceMinor: product.priceMinor,
      currency: product.currency,
      quantity: product.quantity,
      imageReference: product.imageReference,
      syncedAt: product.syncedAt,
      inventoryTracked: product.inventoryTracked,
      inventoryObservedAt: product.inventoryObservedAt,
      collections: product.collections,
      variants: product.variants.map((variant) => ({
        sku: variant.sku,
        variantName: variant.variantName,
        priceMinor: variant.priceMinor,
        currency: variant.currency,
        quantity: variant.quantity,
        inventoryTracked: variant.inventoryTracked,
        inventoryObservedAt: variant.inventoryObservedAt,
        syncedAt: variant.syncedAt,
      })),
    })),
  };
}
