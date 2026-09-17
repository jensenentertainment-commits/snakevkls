# Roy Phase 2A Commit 6: aggregated read-only catalog foundation

This is an **inactive foundation artifact**: a forward migration for
`public.get_roy_catalog_foundation_v1()` and a standalone TypeScript response
contract/validator. No Roy runtime, provider, context, prompt, presentation or
`receivedFields` imports or calls it. Existing Phase 0/1 audits are unchanged.

## Scope and authority

The active population is exactly:

```sql
products.active = true AND products.shopify_product_id IS NOT NULL
```

Product totals count distinct product IDs; variant totals count matching
`products` rows, including null-SKU and legacy null-variant-ID rows. Canonical-only
products, inactive variants and local-only rows are excluded. Canonical
`shopify_status` is not a current scope authority. These are **Snake's persisted
active Shopify-linked catalog totals**, not independently verified live Shopify
totals. For example, canonical content from a new product whose variants all lack
SKUs does not imply an active `products` row. This limitation is returned in every
response alongside `scopeAuthority = snake_products_active_shopify_linked`.

## Query and authorization

The zero-argument RPC is PL/pgSQL, `STABLE`, `SECURITY INVOKER`, with an empty
search path and UTC timestamp formatting. It explicitly requires an active
admin/user through the existing `private.has_role` helper before reading catalog
data. Execution is granted only to `authenticated`, with PUBLIC, anon and
service_role grants revoked. Caller RLS remains in effect. Warehouse callers
receive SQLSTATE 42501 rather than a misleading aggregate built from hidden
canonical rows. No service-role retrieval path is introduced for Roy.

One aggregate query reads the active variant population, groups it by stable
Shopify product identity, selects one deterministic representative variant, and
left-joins canonical content and **preaggregated** canonical collection counts.
This prevents variant/collection join multiplication. Field counts, findings,
examples and freshness use the same stable function snapshot. The bounded JSON
evidence loop afterward performs no table reads or writes.

There are no DML statements, write RPC calls, row/advisory locks, new indexes,
materialized views or persisted caches. Exact counts require scanning the scoped
population; fixed output size does not mean fixed query cost. Isolated query-plan
measurements must precede any new index proposal. Test large synthetic catalogs
and long descriptions; full content is classified inside PostgreSQL, not returned.

## Response contract

`lib/intelligence/roy/catalog-foundation-contract.ts` defines and validates:

| Key | Contract |
| --- | --- |
| `schemaVersion` | `1` |
| `scope` | `active_shopify_products` |
| `scopeAuthority` | `snake_products_active_shopify_linked` |
| `generatedAt` | Retrieval statement time; not observation time |
| `totals` | Exact product and variant counts |
| `contentCoverage` | Observed and unknown product counts |
| `fields` | Fixed eight fields, each with unknown/missing/present counts |
| `collections` | Unknown/incomplete, complete, complete-zero and complete-with-members counts |
| `freshness` | Five separate timestamp populations/ranges |
| `findings` | Fixed completeness codes with exact affected product counts and bounded examples |
| `evidence` | Returned example count, truncation flag and byte-budget reduction flag |
| `limits` | Hard evidence, string and byte bounds |
| `limitations` | Fixed scope, snapshot and interpretation limitations |

There is no unbounded row array, arbitrary field selection, filter, caller-selected
limit, raw description, SEO body, variant list or collection list. Vendor is not
selected or returned. Product, variant, category and collection IDs are internal
join/sort keys only. The output validator rejects unknown keys, altered limits,
non-partitioning counts, unsupported findings, technical-ID tokens, excessive
evidence and oversized UTF-8 serialization. RPC failures are errors, never empty
catalog results. The validator is available for future integration but unused by
Roy in this commit.

## Field and collection semantics

Eight independent fields are counted: product name, description, SEO title, SEO
description, product handle, product type, Shopify Product Category and featured
image reference. Presence is not quality, correctness, relevance or image quality.

- No canonical row/content observation metadata: UNKNOWN, even if a legacy
  variant has a value. Legacy data never fills a canonical coverage gap.
- Observed null, empty or trim-whitespace-only string: MISSING.
- Observed nonempty value: PRESENT.
- Each field's unknown + missing + present counts equals the scoped product
  count. Observed and unknown content counts also partition that population.
- SQL uses an explicit 25-code-point ECMAScript trim set, including NBSP, BOM,
  Unicode space separators and line terminators. U+0085, U+180E and U+200B are
  deliberately not classified as trim whitespace. This matches existing
  `classifyObservedField`; it does not strip HTML or judge meaningful prose.
- Category is independent of merchant product type. Both category components
  null means observed missing. An observed malformed/half-null/invalid-ID/blank-path
  category rejects the entire response with SQLSTATE 22000; it never becomes
  PRESENT. This also covers three-valued CHECK-constraint edge cases.

Missing canonical collection state or `collections_complete = false` contributes
to unknown/incomplete, regardless of child rows or legacy collections. A complete
flag with a valid observation timestamp and zero canonical rows means complete,
no collections. A complete flag with rows means complete membership. Complete
counts partition into zero/with-members, and complete + unknown/incomplete equals
the product population. Malformed/nonfinite required observation timestamps fail
the response instead of inventing metadata.

The RPC reports last committed snapshots. Commit 5 preserves prior complete
snapshots after failed refreshes, so this RPC does not claim to count latest
refresh failures or distinguish failed attempts from an older retained snapshot.
An empty active catalog returns zeros, null timestamp ranges and empty findings.

## Evidence and byte budget

Only nonzero findings are returned, in this fixed order:

1. `content_unknown`
2. `missing_product_name`
3. `missing_description`
4. `missing_seo_title`
5. `missing_seo_description`
6. `missing_product_handle`
7. `missing_product_type`
8. `missing_shopify_category`
9. `missing_image_reference`
10. `collections_unknown_or_incomplete`
11. `collections_complete_zero`

These codes belong to the separate versioned foundation contract. Shared wording
with an existing legacy audit does not change that audit's source or semantics.

Each finding ranks products by internal product ID with explicit `C` collation.
The first eight safe labels per finding are eligible. A round-robin allocation
by example rank, then fixed finding order selects at most **24 entries total**.
This is a deterministic allocation, not severity or quality prioritization.
A product appears once per finding but can support more than one finding;
identical human labels are not incorrectly merged into one product.

An example contains only `productLabel`, `labelSource`, `representativeSku`,
`labelTruncated` and `skuTruncated`. Labels use observed canonical product names
when safe/nonempty, otherwise a representative variant label. The representative
is chosen by nonempty SKU first, SKU in `C` order, then local row ID. That SKU is
an identifying example, not canonical product identity. Unknown-content examples
always carry `labelSource = variant`.

Names are capped at **240 Unicode code points**, SKUs at **120**. Control
characters are replaced with spaces. Source labels/SKUs containing
`gid://shopify/` (case-insensitive) are withheld or use a safe fallback; IDs never
become display labels. Unavailable safe labels cause fewer examples, not fewer
affected products. No descriptions or SEO values are used as evidence labels.

The RPC measures the entire response as UTF-8 `jsonb::text` and accepts an example
only while serialization remains **at most 32,768 bytes**. Examples that do not fit
are omitted; later smaller allocated examples may still fit. It never modifies
aggregate counts. `examplesTruncated` compares returned examples with each exact
affected count; `evidence.truncated` summarizes this. `budgetLimited` specifically
indicates example removal for size. The final result is checked again. The
TypeScript validator separately checks UTF-8 `JSON.stringify` size. This bounds
the JSON value, not HTTP headers or a future enclosing application envelope.

## Freshness

Each range has `populationUnit`, `populationCount`, `timestampCount`, `oldest` and
`newest`. Null values do not become timestamps, and empty ranges return null ends.

- `variantSyncedAt`: scoped variant population and non-null variant sync times.
- `contentObservedAt`: scoped products, successful canonical content observations.
- `collectionsObservedAt`: scoped products, complete membership observations only.
- `shopifyUpdatedAt`: scoped products, Shopify timestamps of observed content.
- `contentPersistedAt`: scoped products, database persistence times of observed content.

No stale threshold, stale finding or freshness score exists. A single database
read snapshot may include observations from different pages and sync runs.

## Validation and executable database gate

Code/static tests and executable PostgreSQL validation are separate.

**Executable PostgreSQL validation: NOT RUN — isolated database target unavailable**

No infrastructure, tools or Supabase branches were created. No migration, fixture,
backfill or production operation was run. Commit 5 is still CODE APPROVED /
EXECUTABLE DATABASE VALIDATION NOT YET VERIFIED. Its transaction fixtures and
Commit 6 aggregation/security/concurrent-read fixtures must pass on a verified
isolated target before production migration or Phase 2A activation.

Local code checks:

```powershell
node --test tests/digital-workforce-roy-catalog-foundation-contract.test.ts tests/roy-phase-2a-catalog-foundation.integration.test.ts
npm.cmd test
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run lint
npm.cmd run build
git diff --check
```

Static tests check SQL security, scope, preaggregation, deterministic allocation,
exact ECMAScript whitespace parity, ID exclusions and runtime disconnection.
Parser tests cover unknown/missing separation, category/type independence,
collection partitions, timestamp populations, 8/24/32-KiB bounds, multi-byte labels,
truncation flags and malformed/unsupported responses. These do not execute SQL.

Local Commit 6 results: 17 new focused tests passed; the combined foundation/Roy/
Commit 5 contract run passed 42 tests; the full suite passed 364 tests. TypeScript
passed. Lint passed with zero errors and the same 29 pre-existing warnings;
new TypeScript files have zero warnings. The production build passed after
allowing the existing Google Fonts downloads blocked in the initial sandbox run.
No existing runtime files or historical migrations changed. The staged diff
whitespace check is required before the local commit. No database fixture or
query-plan measurement was executed.

For a **future independently approved isolated target only**, use the same
PostgreSQL/role/auth prerequisites documented for Commit 5. Apply the complete
migration chain to an empty disposable database, using the existing plain-PG
bootstrap only when needed. Fixtures require a database named `snake_phase2a_test`
or `snake_phase2a_test_<lowercase suffix>` and connection setting
`snake.phase2a_isolated=on`; those guards do not establish isolation themselves.

1. Run `tests/database/roy-phase-2a-catalog-foundation.dynamic.sql` using psql with
   `-X -v ON_ERROR_STOP=1`. The helper chain checks isolation before writes. Tests
   cover empty/mixed catalogs, no-SKU/legacy variants, inactive/canonical-only
   exclusions, no join multiplication, incomplete rows, Unicode, malformed
   categories, role denial, unchanged data, deterministic evidence, byte reduction
   and no ID leakage. The entire fixture transaction rolls back.
2. On the now-empty disposable database, run
   `roy-phase-2a-catalog-foundation-concurrency-setup.sql`. Within its 300-second
   lease, start `roy-phase-2a-catalog-foundation-concurrent-reader.sql`, then
   immediately launch `roy-phase-2a-catalog-foundation-concurrent-writer.sql` in a
   separate connection. The writer executes a real Commit 5 V2 page in a
   transaction held open for two seconds. The reader checks 60 successive calls,
   and also calls the RPC in an explicitly read-only transaction.
3. Both processes must succeed. Run
   `roy-phase-2a-catalog-foundation-concurrency-assertions.sql`: reads must include
   both before/after states and no mixed observation/membership state. Lack of
   actual overlap fails rather than being credited as concurrency evidence.
4. Capture isolated `EXPLAIN (ANALYZE, BUFFERS)` results on the aggregate query at
   representative and larger synthetic sizes, including RLS cost and long content.
   A top-level function scan alone does not expose the internal plan: inspect the
   function's SELECT under the authenticated role or use approved nested-statement
   instrumentation on that isolated target. No index is justified before this.
5. Discard the disposable database. Do not use these fixtures on `vk-lager`,
   `TV19`, or any other non-isolated database.

## Non-goals

No Roy activation, provider/context/prompt/presentation changes, new received
fields, Phase 0/1 audit rewrite, quality assessment, vendor/supplier/brand analysis,
SEO ranking claims, taxonomy correctness or collection relevance judgment,
pricing/inventory policy, migration application, backfill, deployment or Commit 7.
