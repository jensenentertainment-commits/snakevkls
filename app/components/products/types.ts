export type PlacementStatus =
  | "location"
  | "zone"
  | "missing";

export type ProductMeta = {
  quantity: number;
  locationCode: string | null;
  zoneLabel: string | null;
  zoneId: string | null;
  zoneCode: string | null;
  status: PlacementStatus;
};

export type ProductCollection = {
  id: string;
  title: string;
  handle: string | null;
};

export type ProductRow = {
  id: string;
  sku: string | null;
  product_name: string;
  variant_name: string | null;
  image_url: string | null;
  vendor: string | null;
  product_type: string | null;
  shopify_quantity: number;

  product_collections: ProductCollection[];

  inventory: {
    id: string;
    quantity: number;
    zone_id: string | null;

    zones: {
      id: string;
      code: string;
      name: string;
    } | null;

    locations: {
      id: string;
      code: string;
      zone_id: string | null;

      zones: {
        id: string;
        code: string;
        name: string;
      } | null;
    } | null;
  }[];
};

export type ZoneOption = {
  id: string;
  code: string;
  name: string;
};

export type LocationOption = {
  id: string;
  code: string;
  zone_id: string | null;
};