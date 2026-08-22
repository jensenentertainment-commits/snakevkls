import assert from "node:assert/strict";
import test from "node:test";
import {
  enforceRoyContentContract,
  isRoyAnswerValid,
} from "../lib/intelligence/roy/content-contract.ts";
import {
  ROY_RECEIVED_CATALOG_FIELDS,
  type ShopifyCatalogContext,
} from "../lib/intelligence/workforce/contexts/shopify-catalog.ts";

const context: ShopifyCatalogContext = {
  intent: { kind: "product", sku: "SKU-1", reference: "explicit" },
  query: "VK-1",
  scope: "targeted_catalog_sample",
  resultLimit: 24,
  receivedFields: ROY_RECEIVED_CATALOG_FIELDS,
  products: [
    {
      shopifyProductId: "product-1",
      shopifyVariantId: "variant-1",
      variantName: null,
      productName: "Testprodukt",
      sku: "VK-1",
      vendor: "Varekompaniet",
      productType: null,
      priceMinor: 9900,
      currency: "NOK",
      quantity: 2,
      imageReference: null,
      syncedAt: "2026-08-20T10:00:00Z",
      inventoryTracked: true,
      inventoryObservedAt: "2026-08-20T10:00:00Z",
      status: "ACTIVE",
      collections: [{ title: "Alle Produkter", handle: "alle-produkter" }],
      variants: [],
      hasProductFieldConflicts: false,
    },
  ],
  entityScope: "variant",
  audit: null,
  auditSelection: null,
  limitations: [],
};

function answer(input: {
  observed?: string;
  unknown?: string;
  inference?: string;
}) {
  return [
    "OBSERVED",
    input.observed ?? "- [field=sku] SKU VK-1 er mottatt.",
    "UNKNOWN",
    input.unknown ?? "- Produktbeskrivelse er ikke tilgjengelig i mottatt kontekst.",
    "INFERENCE",
    input.inference ?? "- Ingen.",
  ].join("\n");
}

test("omitted field is UNKNOWN, not MISSING", () => {
  assert.equal(isRoyAnswerValid(answer({}), context), true);
});

test("explicitly null received field may be reported missing", () => {
  assert.equal(
    isRoyAnswerValid(
      answer({ observed: "- [field=productType] productType mangler (null)." }),
      context,
    ),
    true,
  );
});

test("description not delivered cannot be observed as missing", () => {
  assert.equal(
    isRoyAnswerValid(
      answer({ observed: "- [field=sku] Produktbeskrivelse mangler." }),
      context,
    ),
    false,
  );
});

test("images not delivered cannot be observed as missing", () => {
  assert.equal(
    isRoyAnswerValid(
      answer({ observed: "- [field=sku] Bilder mangler." }),
      context,
    ),
    false,
  );
});

test("SEO absent from received fields cannot support product SEO assessment", () => {
  assert.equal(
    isRoyAnswerValid(
      answer({
        inference:
          "- [based_on=productName] SEO bør forbedres for dette produktet.",
      }),
      context,
    ),
    false,
  );
});

test("general Shopify best practices cannot be observed VK problems", () => {
  assert.equal(
    isRoyAnswerValid(
      answer({
        observed:
          "- [field=status] Produktet har dårlig publiseringsklarhet og bør endres.",
      }),
      context,
    ),
    false,
  );
});

test("received SKU, price, stock, status, and collection data remain valid", () => {
  const valid = [
    "OBSERVED",
    "- [field=sku] SKU VK-1 er mottatt.",
    "- [field=priceMinor] Pris er 9900 i minste valutaenhet.",
    "- [field=quantity] Lagerantall er 2.",
    "- [field=status] Status er ACTIVE.",
    "- [field=collections] Collection Alle Produkter er mottatt.",
    "UNKNOWN",
    "- Felter utenfor receivedFields kan ikke vurderes.",
    "INFERENCE",
    "- [based_on=status,quantity] Posten er aktiv og har positivt mottatt lagerantall; videre betydning er ukjent.",
  ].join("\n");
  assert.equal(isRoyAnswerValid(valid, context), true);
  assert.equal(enforceRoyContentContract(valid, context), valid);
});

test("invalid model output fails closed to a safe classified fallback", () => {
  const result = enforceRoyContentContract(
    "Produktet mangler bilder og bør SEO-optimaliseres.",
    context,
  );
  assert.match(result, /^OBSERVED\n/u);
  assert.match(result, /\nUNKNOWN\n/u);
  assert.match(result, /\nINFERENCE\n- Ingen\.$/u);
  assert.doesNotMatch(result, /bilder|SEO-optimaliseres/iu);
});
