# Roy Phase 2A Commit 7 — context/contract integration

## Activation and validation gate

The integration is **disabled by default**. The server-only gate reads
`ROY_PHASE2A_ENABLED` and accepts only the exact value `true`. No environment
file, deployment setting or production system is changed by this commit.
RPC availability does not enable the gate. It was verified unset in the local
process and local build environment files during implementation.

Commit 5/6 database verification is still outstanding. Commit 7 adds another
database verification requirement. Production migration/activation requires
separate approval after isolated execution; code tests do not discharge it.

**Executable PostgreSQL validation: NOT RUN — isolated database target unavailable**

No PostgreSQL/Supabase CLI, Docker or Podman executable is available on PATH.
No tooling, branch or infrastructure was installed/created. No SQL was executed
against any connected database. The forward migration was authored offline
because CLI installation/database provisioning is explicitly prohibited.

## Runtime and routing

The existing provider first checks the server gate. Disabled means the original
resolver, provider queries, legacy fields, audits, prompt and presentation run
unchanged. No new RPC is called. Existing read-only capability and authorization
remain in place. Enabled requests use a separate versioned context when routed:

| Request | Reader |
| --- | --- |
| Explicit SKU or resolved product follow-up | `get_roy_targeted_product_v1(requested_sku)` |
| Catalog completeness/count/coverage | `get_roy_catalog_foundation_v1()` |
| Existing audit, missing-type list, legacy collection search | Existing Phase 0/1 reader |
| Ambiguous reference | Clarification without database access |
| Unsupported quality-only question | Factual capability boundary without database access |

Explicit catalog questions are classified before historical references. For
targeted questions the most recent explicit user reference retains priority over
assistant-mentioned siblings or numeric ranges, using the unchanged shared
reference resolver. A new explicit SKU overrides history. Exact `SKU X` syntax
also supports non-hyphenated SKUs. Multiple candidates require clarification.

Legacy missing-product-type lists remain legacy; explicit catalog counts use
canonical foundation semantics. Findings retain their enclosing source/version:
`roy_catalog_foundation_v1` is not the legacy audit. No merged overlapping findings
or legacy fallback for canonical UNKNOWN. Missing SKU remains a variant audit;
duplicate names and inconsistent repeated fields remain legacy audits.

Errors from either RPC, including authorization/transport errors and invalid
contracts, propagate to workforce `context_failed`. They never become an empty
catalog, not-found result, missing observation or legacy fallback.

## Targeted snapshot and authority

The new public RPC is `STABLE`, `SECURITY INVOKER`, with empty search path and UTC
timestamp output. All internal SELECTs use the calling statement snapshot. It
explicitly requires an active admin/user through `private.has_role` before any
catalog reads; authenticated execution retains caller RLS. PUBLIC, anon and
service_role execution are revoked. A private immutable preview helper only
sanitizes strings; it has no data access and is not a Data API endpoint.

Scope is `products.active = true AND shopify_product_id IS NOT NULL`. An exact
SKU match supplies the selected variant; the internal stable Shopify product ID
joins siblings, content and membership. Canonical-only products and canonical
status do not determine scope. Zero matches return `not_found`; more than one
returns `ambiguous`, without observations. Existing unique SKU constraints make
multiple matches unlikely, but the reader does not depend on picking a first row.

`products` remains authoritative for selected SKU, variant name, price/currency,
quantity, tracking and inventory observation, and variant sync time. Synthetic
`Default Title` is normalized to null. Siblings never replace selected facts.
No writer, sync/checkpoint behavior, legacy collection table or schema authority
is changed. No indexes, caches or materialized views are introduced.

## Model-visible observation contract

The Phase 2A context lives separately under `phase2a` on the internal provider
result. Legacy fields are empty on that path and are not model-projected. The
model receives only the validated phase-specific envelope, with its own
`receivedFields`. This list describes **delivered state contracts**, not present
values. Foundation requests receive only `catalogFoundation`, never fictitious
per-product field values.

Targeted fields are namespaced under `productContent`: productName, description,
seoTitleOverride, seoDescriptionOverride, productHandle, productType,
shopifyCategory and imageReference. Each carries `state`, `value`, `truncated`
and `withheld`. Content observation, Shopify update and persistence timestamps
are separate. Selected/sibling variants, canonicalCollections and retrieval time
have separate contract entries.

- No successful canonical content observation: UNKNOWN, null value/timestamps.
- Observed null/empty/ECMAScript-whitespace-only full value: MISSING.
- Observed full value: PRESENT, even if its safe preview is truncated/withheld.
- Malformed category structure: retrieval fails; never PRESENT.
- Unknown/incomplete collections: null count/time and no canonical displayed list.
- Complete zero: exact zero count and empty names, still complete.
- Complete positive: exact count and bounded names. Display truncation does not
  change source completeness or the exact count.

The SQL trim set is the same 25 code points as JavaScript `String.trim`.
U+0085, U+180E and U+200B are not incorrectly classified as missing. Unsafe
control-only previews can be withheld while retaining PRESENT state.

Category output contains the human-readable taxonomy path, never category ID.
Internal product/variant/collection IDs are not returned. Source text containing
`gid://shopify/` is withheld rather than echoed, and the parser rejects leakage.
Vendor is omitted from this new payload and introduces no supplier/brand logic.

Explicit SEO values are merchant overrides. Empty overrides do not prove missing
rendered search-engine metadata. A handle is not evidence that a public URL
resolves. Category and merchant-defined product type remain separate. An image
reference is not proof of gallery completeness or image quality.

Observation times describe the last committed successful snapshots, not the
latest failed refresh attempt. `generatedAt` is retrieval time only. No stale
threshold, score or quality/relevance/correctness judgment is introduced.

## Bounds and presentation

Target limits: 24 displayed collection names, 24 other sibling summaries, and
32,768 bytes for the complete serialized SQL JSON response. The selected variant
is always retained separately. Counts are computed before limits.

Siblings order by SKU with C collation then row ID; collections order by internal
collection ID with C collation. Names can coincide without merging memberships.
Content previews are at most 2,048 Unicode code points for description and 512
for other content fields. Variant SKU is capped at 120, names at 240 and currency
at 12; variant text truncation/withholding is explicit. Collection names are 240.

SQL measures UTF-8 bytes after JSON construction. If over budget it removes
sibling entries from the tail, then collection entries from the tail, then
withholds content previews in a fixed order. It never changes selected numeric
facts, states, timestamps or counts. The TypeScript boundary independently
validates size, exact keys, states, count relationships, limits and timestamps.

The unchanged aggregate RPC retains 8 examples/finding, 24 overall and 32 KiB.
Integration never refills its examples. Namespacing adds a separately checked
36 KiB model data-envelope cap; existing bounded question/history limits apply
outside that envelope. This does not redefine the RPC's 32 KiB contract.

Merchant text is a user-role data message, not a system instruction. Model output
is never rendered as a Phase 2A claim. The public answer is built deterministically
from the validated contract. Source values are quoted with Markdown/HTML escaping.
Internal source codes remain internal; users receive plain Norwegian explanations.

## Executable database fixtures — future isolated target only

Use the prerequisites/bootstrap documented for Commit 5 on an independently
verified disposable database. Apply the full migration chain there only after
approval. Guards require database name `snake_phase2a_test` or
`snake_phase2a_test_<lowercase suffix>` and setting `snake.phase2a_isolated=on`.
These checks do not themselves establish isolation. Never use production,
`vk-lager`, TV19, or an unverified target.

1. Execute `tests/database/roy-phase-2a-targeted.dynamic.sql` with
   `psql -X -v ON_ERROR_STOP=1`. It includes guarded helpers, creates fixture data,
   asserts read-only behavior/states/bounds/roles and rolls back everything.
2. On an empty isolated migrated database, execute
   `roy-phase-2a-targeted-concurrency-setup.sql`.
3. Within the 300-second lease, start `roy-phase-2a-targeted-concurrent-reader.sql`
   and immediately run the existing
   `roy-phase-2a-catalog-foundation-concurrent-writer.sql` in another connection.
   The writer applies a real Commit 5 V2 page and delays its commit.
4. Execute `roy-phase-2a-targeted-concurrency-assertions.sql`. Both old/new
   snapshots must have been seen and no mixed content/membership state accepted.
   The reader also calls the RPC in an explicit READ ONLY transaction.
5. Discard that disposable database. Commit 5/6 fixtures must independently pass.

No executable result is claimed for these fixtures. Query-plan/performance
measurement also remains for an approved isolated target, including large sibling
and collection populations and RLS cost. No speculative index is added.

## Validation

Focused code tests cover all seven requested conversational scenarios, reference
priority/ambiguity, unknown versus missing, complete versus truncated membership,
SEO/handle/category terminology, selected variant facts, IDs, injection, strict
RPC parsing, byte bounds and failure propagation. Existing Roy and sync suites
remain regression coverage. SQL/security/whitespace checks are static contracts,
not SQL execution.

Commands: focused `node --test tests/digital-workforce-roy-phase2a.test.ts`, full
`npm.cmd test`, `node node_modules/typescript/bin/tsc --noEmit --incremental false`,
`npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.

The local build initially could not download the existing Google Fonts resources;
it passed after allowing those downloads. No deployment was performed.

Final local results: 30 new focused tests passed; 159 combined Roy/Phase 2A/sync
regression tests passed; all 394 full-suite tests passed. TypeScript passed.
Lint passed with zero errors and the same 29 pre-existing warnings. Production
build passed. SQL/security/Unicode contract checks passed as code/static tests.
Git whitespace checks passed; the staged check is repeated before commit.

## Exact Commit 7 file inventory

Modified:

- `lib/intelligence/roy/chat-input-builder.ts`
- `lib/intelligence/roy/content-contract.ts`
- `lib/intelligence/roy/presentation.ts`
- `lib/intelligence/workforce/capabilities/shopify-read-catalog.ts`
- `lib/intelligence/workforce/capability.ts`
- `lib/intelligence/workforce/contexts/shopify-catalog-provider.ts`
- `lib/intelligence/workforce/contexts/shopify-catalog.ts`
- `lib/intelligence/workforce/runtime.ts`
- `tests/digital-workforce-roy-contract.integration.test.ts`
- `tests/roy-phase-2a-catalog-foundation.integration.test.ts`

Added:

- `docs/roy-phase-2a-context-integration.md`
- `lib/intelligence/roy/phase2a-context.ts`
- `lib/intelligence/roy/phase2a-gate.ts`
- `lib/intelligence/roy/phase2a-presentation.ts`
- `lib/intelligence/roy/targeted-content-contract.ts`
- `supabase/migrations/20260919090000_phase_2a_roy_targeted_reader.sql`
- `tests/database/roy-phase-2a-targeted-concurrency-assertions.sql`
- `tests/database/roy-phase-2a-targeted-concurrency-setup.sql`
- `tests/database/roy-phase-2a-targeted-concurrent-reader.sql`
- `tests/database/roy-phase-2a-targeted.dynamic.sql`
- `tests/database/roy-phase-2a-targeted.helpers.sql`
- `tests/digital-workforce-roy-phase2a.test.ts`

## References and non-goals

Reviewed [Supabase function security](https://supabase.com/docs/guides/database/functions)
and [PostgreSQL STABLE snapshot semantics](https://www.postgresql.org/docs/current/xfunc-volatility.html).
The Supabase changelog was checked; no relevant newly introduced API was required.

No production migration, backfill, checkpoint reset, Shopify mutation, deployment,
gate activation, UI modification, Product Quality Intelligence or Commit 8 work.
