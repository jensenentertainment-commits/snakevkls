export type ShopifyCatalogProduct = {
  sku: string | null;
  productName: string;
  vendor: string | null;
  productType: string | null;
  status: string | null;
  priceMinor: number | null;
  currency: string | null;
  quantity: number | null;
  collections: readonly { title: string; handle: string | null }[];
};

export type ShopifyCatalogContext = {
  query: string;
  scope: "targeted_catalog_sample";
  resultLimit: number;
  products: readonly ShopifyCatalogProduct[];
  limitations: readonly string[];
};
