# Roy Phase 2A Commit 5: transactional sync persistence

This extends the existing resumable Shopify sync with product-level observations.
`public.products` remains variant authority; `product_collections` remains the
variant-based compatibility relation used by existing Snake consumers.

## Architecture and transaction sequence

The source reads 20 variants per catalog page. It traverses collections once per
unique product within that page, using the existing bounded, throttled cursor
reader. Every traversal must explicitly finish. A source failure aborts the page
before persistence. Deduplication does not cache across catalog pages or runs.

`prepareShopifyPersistencePage` separates the legacy variant payloads from unique
product snapshots keyed by Shopify product ID. Conflicting observations for the
same product, mismatched identity, and disagreement between canonical and legacy
membership fail closed. No-SKU variants still contribute canonical content.

The application makes one `apply_shopify_sync_page_v2` HTTP RPC per page:

1. Validate the envelope, then lock the specific `private.sync_runs` row.
2. Validate running status, non-null matching lease token, unexpired lease,
   expected cursor, `expected_pages_processed`, and persisted `has_next_page`.
3. Validate every product/collection observation and its relationship to the
   variants before any domain write. Missing keys, malformed IDs/timestamps,
   incomplete observations, and duplicate identities are rejected.
4. Upsert `shopify_product_content` by Shopify product ID in stable ID order.
   Explicit null/empty fields replace previous values; absent fields are errors.
5. Delete and insert `shopify_product_collections` for each observed product,
   then set `collections_complete = true` and its observation timestamp.
6. Call the unchanged `apply_shopify_sync_page` function **inside PostgreSQL**.
   It preserves the established variant/SKU/price/inventory logic, legacy
   collection replacement, seen IDs, counters, checkpoint and lease renewal.
7. Check the original lease deadline again and return the page acknowledgement.

The nested SQL call is part of the same database transaction. There is no
intermediate HTTP write or exception handler that could commit a partial page.
Any validation, constraint, lease, canonical, variant, legacy or checkpoint
failure rolls back the whole page, including timestamps and counters.
Activity logging and run completion remain separate existing operations.

## Observation semantics

| Persisted state | Meaning |
| --- | --- |
| No row or no content observation metadata | UNKNOWN content |
| Observed nullable/empty field | MISSING field |
| Observed field containing a value | OBSERVED field |
| `collections_complete = false` | UNKNOWN/incomplete membership |
| `collections_complete = true`, no membership rows | Complete, zero collections |
| `collections_complete = true`, membership rows | Complete canonical membership |

V2 only accepts **complete** collection observations. Unknown/incomplete input
rejects the entire page, leaving an existing complete snapshot, flag and
observation time unchanged. V2 never demotes a complete snapshot. Complete empty
observations atomically remove prior membership and retain the complete flag.
Thus readers see the last committed snapshot, which may be older after a failed
refresh. A flag is not a claim that a subsequent failed attempt succeeded.

The timestamps have separate meanings:

- `shopify_updated_at`: Shopify `Product.updatedAt`, mapped as `shopifyUpdatedAt`.
- `content_observed_at`: Snake's `contentObservedAt`, captured when a successful
  catalog response arrives, before any subsequent collection traversal.
- `collections_observed_at`: successful completion of the collection traversal.
- `synced_at`: database persistence time (`clock_timestamp()` for canonical content).

Required non-empty identity/name/handle/status fields retain the foundation's
constraints; nullable descriptive fields preserve explicit null and empty values.
Shopify does not provide a transactionally frozen multi-request collection
snapshot: complete here means the successful cursor traversal contract, not a
new guarantee against concurrent Shopify catalog edits.

## Checkpoints, recovery and rollout

`claim_shopify_sync_run` keeps its signature and behavior and returns persisted
`hasNextPage` in both the acquired and busy responses. If a reclaimed run has
`hasNextPage = false` and at least one committed page, the engine calls completion
without fetching or reapplying the final page. The existing completion RPC still
performs reconciliation separately and atomically with marking the run complete.

Every page carries expected cursor **and** expected page count. Run-row locking
serializes concurrent attempts. A duplicate/stale attempt is rejected rather
than counted again, including empty final pages with null cursors. Upserts are by
stable IDs; canonical membership is replaced as a whole. A failed page can be
refetched and applied using a reclaimed lease and its unchanged checkpoint.

After an ambiguous apply/completion response, the engine reads
`get_shopify_sync_run(requested_run_id)` for that exact run. A persisted completed
run is returned as completed. Otherwise the invocation stops and normal lease
reclaim uses the stored cursor/count/final-page flag. An unchanged read does not
prove rollback: the original transaction might still be running. No blind write
retry or failure-marking occurs for an ambiguous outcome. If the state read also
fails, the lease is left to expire. A received SQL rejection plus an unchanged
running checkpoint permits the existing token-fenced failure RPC.

The new forward migration removes `shopify_product_content_handle_key` and creates
the non-unique `shopify_product_content_handle_idx`. Historical foundation SQL is
unchanged. Handle reassignment cannot collide with another product's historical
observation. The authoritative identity remains the Shopify product ID.

Retain V1 for older workers; V2 never falls back to V1 silently. Future rollout
must apply the forward migration before enabling the new application writer.
An old worker can continue using its existing RPC. Pages already processed by an
old writer are not revisited, marked observed, or backfilled. Their canonical
coverage remains UNKNOWN until a separately approved full sync/backfill. There
is no checkpoint reset or change to variant-based run counters. The retained old
writer itself does not gain V2 page-count fencing.

## Security and compatibility

V2 is `SECURITY DEFINER`, has an empty search path, uses schema-qualified domain
objects, and is revoked from PUBLIC, anon and authenticated. Only service_role
receives execute. Existing admin/user read-only RLS on canonical tables remains;
warehouse users gain no new access. No dynamic SQL is used in production RPCs.

Lager, Viper and Lagersalg keep their existing tables and variant identity. The
legacy writer and all its price, SKU, physical inventory, seen-ID and counter
logic remain unchanged. Canonical collection IDs are unique per product; legacy
collection counters remain per persisted variant. The new whole-page validation
intentionally makes malformed/incomplete input fail closed for all page writes.

## Code and static validation

Run from the repository root using the already installed dependencies:

```powershell
node --test lib/shopify/catalog-sync.test.ts lib/shopify/catalog-source.test.ts lib/shopify/collection-pagination.test.ts lib/shopify/sync-engine.test.ts lib/shopify/sync-recovery.test.ts lib/shopify/sync-persistence.test.ts tests/roy-phase-2a-sync-persistence.integration.test.ts
npm.cmd test
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run lint
npm.cmd run build
git diff --check
```

Unit tests cover normalization, distinct timestamps, observed missing values,
absent fields, shared variants, and known versus ambiguous failures. Recovery
tests cover committed/uncommitted/unknown outcomes, failed authoritative reads,
lost completion responses, final-page recovery, and old checkpoint continuation.
Existing collection pagination and Shopify sync regressions remain in the suite.
Static tests check the RPC signature/security, nested legacy delegation,
checkpoint fencing, forward index correction and unchanged claim behavior apart
from the extra response flag. **Static checks do not execute SQL.**

Local Commit 5 validation: 81 focused tests and 347 full-suite tests passed;
TypeScript passed; lint passed with 29 pre-existing warnings and zero errors
(changed TypeScript files have zero warnings); production build passed after
allowing the existing Google Fonts fetches blocked by the initial sandbox run.
`git diff --check` passed. No live Shopify or database requests were part of the
regression tests. Existing Lager, Viper, Lagersalg and legacy sync contracts pass;
this is code/contract evidence, separate from the database limitation below.

## Executable database verification

**NOT RUN — isolated database target unavailable**

No verified safe PostgreSQL/Supabase test target is currently available. No
database tooling was installed, infrastructure created, Supabase branch created,
production migration applied, or database fixture executed. Neither production
`vk-lager` nor unrelated `TV19` is a test target.

Required capability before database validation can be claimed:

- A disposable isolated PostgreSQL database compatible with the deployed
  Supabase version, supporting PL/pgSQL, required extensions, roles/RLS and the
  repository's complete migration chain.
- An administrative test connection for migrations, test roles, failure-injection
  triggers and synthetic fixtures; service_role/anon/authenticated identities
  for permission tests. Use `supabase-local-bootstrap.sql` only for an empty plain
  PostgreSQL target that lacks the Supabase role/auth foundation, never an
  existing Supabase project.
- `psql` or an equivalent executable harness and **two independent connections**
  for actual lock contention and concurrent page application.

The fixtures reject execution unless the database name matches
`snake_phase2a_test` or `snake_phase2a_test_<lowercase suffix>` and the connection
setting `snake.phase2a_isolated` is `on`. These are accidental-use guards, not a
substitute for verifying isolation. Do not rename or relabel a production target.

After a future isolated target is explicitly approved and provisioned separately:

1. Bootstrap only if needed, then apply the full migration chain in timestamp
   order, including Commit 5, to an empty database. Do not seed production data.
2. Connect with `PGOPTIONS=-c snake.phase2a_isolated=on` (or equivalent connection
   startup setting). Run `psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f
   tests/database/roy-phase-2a-sync-persistence.dynamic.sql`. The script rolls all
   fixture data and test triggers back. It asserts real writes, explicit missing
   overwrites, complete-empty replacement, handle reassignment, no-SKU content,
   counters, physical inventory preservation, replay/lease fencing, rollback at
   each write stage, old-writer rollout, final-page reclaim, grants and RLS.
3. In the same now-empty disposable database, run
   `roy-phase-2a-sync-persistence-concurrency-setup.sql`. It commits synthetic
   fixtures. Within its 300-second lease, launch two separate psql processes
   simultaneously with `-v worker=one` / `-v worker=two` and
   `roy-phase-2a-sync-persistence-concurrent-call.sql`. Each must exit successfully;
   one records a commit and the other a checkpoint conflict. A test trigger
   holds the actual transaction open for two seconds to overlap calls.
4. Run `roy-phase-2a-sync-persistence-concurrency-assertions.sql`; counters and
   all relation counts must reflect exactly one page. Discard the isolated
   database afterward; these fixtures are not production cleanup scripts.

These scripts are prepared test artifacts, not evidence of PostgreSQL execution.
Executable transaction/concurrency/security results remain a rollout validation
gap until that independent test environment is available.

## Non-goals

No deployment, production migration, infrastructure provisioning, backfill,
checkpoint reset, Shopify mutation, UI changes, Roy provider/context changes,
new received fields, aggregate read RPC (Commit 6), or Product Quality Intelligence.
