import { useMemo } from "react";
import type { ProductRow } from "./types";
import { getMeta } from "./utils";

type StatusFilter = "all" | "missing" | "zone" | "location" | "diff";

type Args = {
  products: ProductRow[];
  query: string;
  statusFilter: StatusFilter;
  zoneFilter: string;
  collectionFilter: string;
  sortMode: "az" | "za";
};

const ignoredCollections = new Set([
  "AVADA Email Marketing - Newest Products",
  "AVADA Email Marketing - Best Sellers",
]);

export function useProductsFiltering({
  products,
  query,
  statusFilter,
  zoneFilter,
  collectionFilter,
  sortMode,
}: Args) {
  const collections = useMemo(() => {
    const map = new Map<string, { title: string; handle: string | null }>();

    products.forEach((product) => {
      product.product_collections?.forEach((collection) => {
        if (ignoredCollections.has(collection.title)) return;

        map.set(collection.title, {
          title: collection.title,
          handle: collection.handle,
        });
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.title.localeCompare(b.title, "nb")
    );
  }, [products]);

  const filtered = useMemo(() => {
    let result = products;
    const q = query.trim().toLowerCase();

    if (q) {
      result = result.filter((product) => {
        const meta = getMeta(product);

        return [
          product.sku ?? "",
          product.product_name,
          product.variant_name ?? "",
          product.vendor ?? "",
          product.product_type ?? "",
          meta.locationCode ?? "",
          meta.zoneLabel ?? "",
          product.product_collections?.map((c) => c.title).join(" ") ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((product) => {
        const meta = getMeta(product);
        const diff = (product.shopify_quantity ?? 0) - meta.quantity;

        if (statusFilter === "missing") return meta.status === "missing";
        if (statusFilter === "zone") return meta.status === "zone";
        if (statusFilter === "location") return meta.status === "location";
        if (statusFilter === "diff") return diff !== 0;

        return true;
      });
    }

    if (collectionFilter !== "all") {
      result = result.filter((product) =>
        product.product_collections?.some(
          (collection) => collection.title === collectionFilter
        )
      );
    }

    if (zoneFilter !== "all") {
      result = result.filter((product) => {
        const meta = getMeta(product);
        return meta.zoneId === zoneFilter;
      });
    }

    result = [...result].sort((a, b) => {
      const aName = a.product_name.toLowerCase();
      const bName = b.product_name.toLowerCase();

      if (sortMode === "az") {
        return aName.localeCompare(bName, "nb");
      }

      return bName.localeCompare(aName, "nb");
    });

    return result;
  }, [products, query, statusFilter, zoneFilter, collectionFilter, sortMode]);

  return {
    collections,
    filtered,
  };
}