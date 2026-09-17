import assert from "node:assert/strict";
import test from "node:test";
import { classifyCollectionMembership } from "../intelligence/roy/product-content-contract.ts";
import {
  CollectionPaginationError,
  paginateProductCollections,
} from "./collection-pagination.ts";

const productId = "gid://shopify/Product/1";
const observedAt = "2026-09-17T12:00:00Z";

function page(ids: number[], hasNextPage = false, endCursor: string | null = ids.length ? `c-${ids.at(-1)}` : null) {
  return {
    edges: ids.map((id) => ({ node: { id: `gid://shopify/Collection/${id}`, title: `Collection ${id}`, handle: `collection-${id}` } })),
    pageInfo: { hasNextPage, endCursor },
  };
}

for (const count of [0, 1, 19, 20, 21, 120, 121, 250]) {
  test(`completes ${count} collections only after an explicit final page (20 then 100 per page)`, async () => {
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const pages = [page(ids.slice(0, 20), count > 20)];
    for (let start = 20; start < count; start += 100) {
      pages.push(page(ids.slice(start, start + 100), count > start + 100));
    }
    const cursors: string[] = [];
    const observation = await paginateProductCollections({
      productId,
      firstPage: pages[0],
      now: () => observedAt,
      async fetchPage(id, cursor) {
        assert.equal(id, productId);
        assert.equal(cursor, pages[cursors.length].pageInfo.endCursor);
        cursors.push(cursor);
        return pages[cursors.length];
      },
    });
    assert.equal(cursors.length, pages.length - 1);
    assert.equal(observation.state, "complete");
    assert.equal(observation.observedAt, observedAt);
    assert.deepEqual(observation.collections.map((collection) => collection.id), ids.map((id) => `gid://shopify/Collection/${id}`));
    assert.equal(classifyCollectionMembership(observation), count ? "present" : "none");
  });
}

test("deduplicates by stable collection ID within and across pages, preserving first occurrence", async () => {
  const later = page([1, 2, 2, 3]);
  later.edges[0].node.title = "Changed duplicate";
  const result = await paginateProductCollections({
    productId,
    firstPage: page([1, 1, 2], true),
    fetchPage: async () => later,
  });
  assert.deepEqual(result.collections.map(({ id }) => id), [1, 2, 3].map((id) => `gid://shopify/Collection/${id}`));
  assert.equal(result.collections[0].title, "Collection 1");
});

test("a later-page failure retains incomplete evidence and cannot become complete", async () => {
  await assert.rejects(paginateProductCollections({
    productId,
    firstPage: page([1], true),
    fetchPage: async () => { throw new Error("network failure"); },
    now: () => observedAt,
  }), (error: unknown) => {
    assert.ok(error instanceof CollectionPaginationError);
    assert.equal(error.productId, productId);
    assert.match(error.message, /network failure/);
    assert.equal(classifyCollectionMembership(error.observation), "incomplete");
    assert.equal(error.observation.observedAt, observedAt);
    assert.equal(error.observation.collections.length, 1);
    return true;
  });
});

for (const invalid of [
  undefined,
  null,
  { edges: [] },
  { edges: [], pageInfo: { hasNextPage: "false", endCursor: null } },
  { pageInfo: { hasNextPage: false, endCursor: null } },
  { edges: [], pageInfo: { hasNextPage: false } },
  page([], true, "next"),
  page([1], true, null),
  page([1], false, ""),
  { ...page([1]), edges: [{ node: { id: "not-a-collection", title: "Invalid", handle: null } }] },
]) {
  test(`malformed first page stays unknown: ${JSON.stringify(invalid)}`, async () => {
    await assert.rejects(paginateProductCollections({
      productId,
      firstPage: invalid,
      fetchPage: async () => assert.fail("invalid initial evidence must not trigger another fetch"),
    }), (error: unknown) => {
      assert.ok(error instanceof CollectionPaginationError);
      assert.deepEqual(error.observation, { state: "unknown", observedAt: null, collections: [] });
      return true;
    });
  });
}

for (const pages of [
  [page([2], true, "c-1")],
  [page([2], false, "c-1")],
  [page([2], true, "c-2"), page([3], true, "c-1")],
  [page([1], true, "new-cursor-without-new-membership")],
  [page([2], true, null)],
  [{ edges: [], pageInfo: { endCursor: null } }],
  [page([], true, "c-2")],
]) {
  test(`invalid later progress stays incomplete: ${JSON.stringify(pages)}`, async () => {
    let requests = 0;
    await assert.rejects(paginateProductCollections({
      productId,
      firstPage: page([1], true),
      fetchPage: async () => pages[requests++],
    }), (error: unknown) => {
      assert.ok(error instanceof CollectionPaginationError);
      assert.equal(error.observation.state, "incomplete");
      return true;
    });
    assert.equal(requests, pages.length);
  });
}

test("retry starts from fresh initial evidence, without retaining partial collections", async () => {
  await assert.rejects(paginateProductCollections({
    productId, firstPage: page([1], true), fetchPage: async () => { throw new Error("interrupted"); },
  }));
  const retry = await paginateProductCollections({
    productId, firstPage: page([]), fetchPage: async () => assert.fail("complete empty is terminal"),
  });
  assert.deepEqual(retry.collections, []);
  assert.equal(classifyCollectionMembership(retry), "none");
});
