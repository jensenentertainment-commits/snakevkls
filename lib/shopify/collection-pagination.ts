import type { ProductCollectionObservation } from "../intelligence/roy/product-content-contract.ts";
import type { ShopifyCollectionNode } from "./catalog-sync.ts";

export const SHOPIFY_COLLECTIONS_QUERY = `
  query ProductCollections($productId: ID!, $cursor: String!) {
    product(id: $productId) {
      id
      collections(first: 100, after: $cursor, sortKey: ID) {
        edges { node { id title handle } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export class CollectionPaginationError extends Error {
  readonly productId: string;
  readonly observation: Exclude<ProductCollectionObservation, { state: "complete" }>;

  constructor(
    productId: string,
    observation: Exclude<ProductCollectionObservation, { state: "complete" }>,
    cause: unknown,
  ) {
    super(`Shopify collection pagination failed for ${productId}: ${
      cause instanceof Error ? cause.message : "invalid response"
    }`);
    this.name = "CollectionPaginationError";
    this.productId = productId;
    this.observation = observation;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid collection page");
  }
  return value as Record<string, unknown>;
}

function readPage(value: unknown) {
  const connection = record(value);
  const pageInfo = record(connection.pageInfo);
  if (!Array.isArray(connection.edges) || typeof pageInfo.hasNextPage !== "boolean") {
    throw new Error("Missing collection edges or explicit hasNextPage");
  }
  const endCursor = pageInfo.endCursor;
  if (endCursor !== null && (typeof endCursor !== "string" || !endCursor.trim())) {
    throw new Error("Invalid collection endCursor");
  }
  const collections = connection.edges.map((edge) => {
    const node = record(record(edge).node);
    if (
      typeof node.id !== "string" ||
      !/^gid:\/\/shopify\/Collection\/\d+$/.test(node.id) ||
      typeof node.title !== "string" ||
      (node.handle !== null && typeof node.handle !== "string")
    ) {
      throw new Error("Invalid collection identity or fields");
    }
    return { id: node.id, title: node.title, handle: node.handle };
  });
  if ((collections.length > 0 || pageInfo.hasNextPage) && !endCursor) {
    throw new Error("Collection page has no progress cursor");
  }
  if (pageInfo.hasNextPage && collections.length === 0) {
    throw new Error("Empty non-final collection page");
  }
  return { collections, hasNextPage: pageInfo.hasNextPage, endCursor };
}

/** A fresh traversal per product snapshot; no partial or failed cache survives a retry. */
export async function paginateProductCollections(input: {
  productId: string;
  firstPage: unknown;
  fetchPage: (productId: string, cursor: string) => Promise<unknown>;
  now?: () => string;
  onPage?: (evidence: { cursor: string | null; hasNextPage: boolean; membershipCount: number; observedAt: string }) => void;
}): Promise<Extract<ProductCollectionObservation, { state: "complete" }>> {
  const collections = new Map<string, ShopifyCollectionNode>();
  const cursors = new Set<string>();
  const now = input.now ?? (() => new Date().toISOString());
  let observedAt: string | null = null;
  let pageValue = input.firstPage;

  try {
    if (!/^gid:\/\/shopify\/Product\/\d+$/.test(input.productId)) {
      throw new Error("Invalid Shopify product identity");
    }
    while (true) {
      const page = readPage(pageValue);
      if (page.endCursor && cursors.has(page.endCursor)) {
        throw new Error("Repeated collection cursor: no pagination progress");
      }
      if (cursors.size > 0 && page.hasNextPage &&
        page.collections.every((collection) => collections.has(collection.id))) {
        throw new Error("Collection page made no membership progress");
      }
      if (page.endCursor) cursors.add(page.endCursor);
      observedAt ??= now();
      for (const collection of page.collections) {
        // First occurrence wins, independent of duplicate relations across pages.
        if (!collections.has(collection.id)) collections.set(collection.id, collection);
      }
      const pageObservedAt = now();
      input.onPage?.({ cursor: page.endCursor as string | null, hasNextPage: page.hasNextPage, membershipCount: collections.size, observedAt: pageObservedAt });
      if (page.hasNextPage === false) {
        return { state: "complete", observedAt: pageObservedAt, collections: [...collections.values()] };
      }
      pageValue = await input.fetchPage(input.productId, page.endCursor!);
    }
  } catch (cause) {
    throw new CollectionPaginationError(
      input.productId,
      observedAt === null
        ? { state: "unknown", observedAt: null, collections: [] }
        : { state: "incomplete", observedAt, collections: [...collections.values()] },
      cause,
    );
  }
}
