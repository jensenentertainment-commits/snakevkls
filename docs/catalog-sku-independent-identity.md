# SKU-independent catalog identity — local implementation

Complete local PostgreSQL fresh and upgrade acceptance PASSED on 2026-11-08.
Production migration, sync recovery and activation remain unapproved. Current
delivery/preflight boundary: docs/release-manifest-2026-11-08.md.

## Forward migration contract

1. Keep all seven Phase 2A migrations unchanged, including protected lock ordering.
2. Apply `20261108170000_sku_independent_catalog_identity.sql` after that chain.
   This removes both SKU uniqueness mechanisms, retains the nonunique lookup
   index, and replaces existing private writer/completion implementations and
   the protected writer/completion/proof projections. It makes no data rewrite.
3. `20261108170100_viper_optional_sku_compatibility.sql` additionally requires the
   three unchanged local Viper migrations dated November 3–4. It only replaces
   validation and the source/stock command wrapper to remove cross-catalog SKU
   equality. The catalog migration itself does not depend on Viper job versions.

The local fresh/upgrade runner applies the full sorted local chain, including
those Viper migrations. This is NOT permission to deploy all pending migrations
to production. Production repair needs a separately reviewed exact manifest,
backup/restore and worker-quiescence window. Do not run any writer between removal
of SKU uniqueness and replacement of SKU-fallback logic: one migration transaction
owns those changes together.

## Identity and persistence

Only exact Shopify Variant-ID selects an existing products row. UUID is never
reassigned. The selected row is locked through its update. An unseen variant creates a new UUID, including when its SKU is NULL
or equals another row's SKU. Existing unlinked/manual rows are not adopted. A
changed source SKU is descriptive; observed absent/blank SKU clears the old value.
Existing stock, location, order, sale and movement references never move.

V1 remains callable behind its existing service-role guard; V2 retains canonical
content/collections + legacy/variant writes + cursor/page count in one transaction.
`skippedNoSku` remains a compatibility/historical counter; new pages never add to
it. Old skipped pages are not replayed or populated by migration. Later controlled
full retrieval is required to cover previously unobserved variants.

## Completion barrier and diagnostics

Operation -> run order is preserved for protected completion. Ordinary completion
locks its run first. Both then use one private, deterministic EXCLUSIVE/NOWAIT
table-lock sequence: pick_jobs, orders, order_lines, pick_lines, pick_exceptions,
products, inventory, warehouse_sale_lines, warehouse_sale_shopify_sync_jobs.

EXCLUSIVE conflicts with both DML and SELECT FOR UPDATE/SHARE table locks, but
allows ordinary reads. NOWAIT means the reconciliation attempt fails with 55P03
instead of waiting while holding a partial dependency-lock set. Acquired locks
roll back with the rejected call. READ COMMITTED is required so committed changes
are visible after locking. This is a brief whole-table finalization barrier, not
reservations or new warehouse functionality; busy warehouse activity can postpone
completion. There are no network calls under these locks.

An active unseen product blocks the entire finalization when it has:

- any inventory row with quantity > 0 (not a summed balance);
- order lines linked by UUID or exact variant ID on received/ready_to_pick/picking orders;
- ready/in_progress pick lines/jobs;
- an open exception, even if its job otherwise looks terminal;
- a sale line with pending/processing/failed Shopify outbox work.

Completed/cancelled order and pick history, resolved exceptions, synced sales,
empty inventory rows and old movements alone do not block. No reference is deleted.
The rule is evaluated at the serialized completion boundary, not a promise that
future independent warehouse operations cannot subsequently create dependencies.

Blockers raise P0001 / SHOPIFY_DEACTIVATION_BLOCKED before any product UPDATE.
DETAIL contains exact blocked count, up to 24 UUID/reason examples and truncation.
The ordinary worker retains a bounded UUID/reason message and marks the run failed
only after authoritative checkpoint recovery, using the existing error flow.
SQL lock rejection 55P03 is likewise explicit rather than an ambiguous transport
outcome. Earlier committed pages remain intact; resume retries completion only.

For a complete diagnostic list, an authorized database operator can read:

```sql
select * from private.catalog_deactivation_blockers_v1('<run UUID>')
order by product_id;
```

This private diagnostic has no API-role grants and is only a snapshot outside the
completion transaction. Do not reset checkpoints, transfer stock, remap identities,
or cancel work merely to clear a blocker. Those require separate operational review.
Protected approval/preview/completion still roll back together on a blocker.

## Compatibility

- Viper resolves by Variant-ID; stock, active/location checks, command version,
  idempotency and authorization remain unchanged. Its conservative imported-order
  source comparison still includes SKU as observed order data. A changed Shopify
  order can therefore still require review; catalog SKU disagreement alone cannot
  block picking. No fulfillment, channel or picking workflow expansion.
- Roy legacy SKU queries fail unresolved when multiple variants match, including
  siblings. Canonical targeted readers already return ambiguous. No gate enabled.
- Backfill expected effects and UUID checks use Variant-ID only. Proof targeted
  samples require unique eligible SKU; aggregate counts and source receipt checks
  include SKU-less and duplicate-SKU variants. Zero eligible samples is explicit
  and does not invent samples or suppress source mismatch failures.
- Lagersalg retains UUID keys, immutable line snapshots and outbox idempotency.
  No production code changes to its sale/stock writer.

## Executed isolated acceptance — passed 2026-11-08

Both exact allowlisted local targets must start empty. The existing runner performs
identity and empty-state checks before bootstrap. Only after separate approval:

1. Fresh matrix: synthetic auth/roles + historical baseline + full migration chain.
2. Upgrade matrix: old writer/checkpoint, four physical units and movement history,
   including an old no-SKU skip; forward schema preserves them without fabrication.
3. Existing persistence/pagination, fault injection, RLS, canonical reader and
   protected backfill suites (updated no-SKU counter expectations).
4. `catalog-identity.dynamic.sql`: duplicate/missing SKU, old linked/unlinked UUIDs,
   replay, explicit SKU clearing, all blocker classes/statuses, atomic rejection,
   failure after deactivation, resume, history-only completion and privilege checks.
5. `catalog-viper-sales.dynamic.sql`: ordinary preview/import/start/confirm/complete,
   source SKU differing from catalog, NULL SKU, command replay, real local sale RPC
   and outbox creation. No external integration call is made.
6. Committed synthetic concurrency setup plus six deterministic two-session cases:
   inventory update/insert, order update/insert, active pick update and product SHARE
   lock. Completion must immediately reject 55P03 with no partial changes, then
   complete from the same terminal checkpoint after writer rollback. Completion's
   test transaction rolls back. Exact fixture cleanup runs only after all succeed.
7. Existing protected lock-order, acknowledgement-loss, completion/stale-preview,
   SQL snapshot export and offline proof checks continue afterward.

Both matrices have executed successfully on the approved disposable local targets.
Future reruns and resets still require separate authorization. On first failure retain the
target/evidence and stop; never automatically reset. Schema-only rollback after SKU
duplicates are admitted cannot simply restore unique indexes; use a separately
reviewed forward recovery or a validated backup. Production remains blocked.

## Local validation and changed-file manifest

### Executable continuation, 2026-11-08

The approved local cluster was restarted normally after an unclean shutdown;
PostgreSQL completed WAL recovery and identity/state checks passed. No PID file
was manually removed. Fresh retained its migrated schema and historical baseline;
upgrade was independently verified empty before the complete upgrade matrix.

One fixture barrier timed out because its transaction could retain an old
`pg_stat_activity` snapshot while waiting for a newly opened peer. The synthetic
`wait_catalog_barrier` now calls `pg_stat_clear_snapshot()` on each poll. Its lock
conditions, timeout and expected outcomes are unchanged; a static regression
asserts the refresh. The retained synthetic setup was checked before replacing
only that test helper and repeating the six rollback-protected scenarios.

Results: all six concurrency scenarios passed on each target (12/12); both
recovery/completion/export continuations passed; each offline proof passed 23/23
checks. Upgrade passed all 34 migrations and the six dynamic suites, including
Viper/Lagersalg. Subsequently, the separately approved fresh reset retained a
pre-reset dump and was followed by one uninterrupted complete fresh run: all 34
migrations, six dynamic suites, six concurrency scenarios and 23 proof checks passed.
Evidence: `C:/Users/jense/AppData/Local/SnakeCatalogValidation/acceptance-full-fresh-20261108`.
Local regression tests
passed 22/22, with focused lint, JS syntax and diff checks passing.

Evidence: `C:/Users/jense/AppData/Local/SnakeCatalogValidation/acceptance-resumed-20261108-1807`
(initial barrier failure, `barrier-fix` continuation, and `upgrade` full run).
Previous evidence remains intact. The proof JSON's static
`executableDatabaseValidation` disclaimer still says NOT RUN; it is not a live
execution-status field. These execution logs establish the results above, while
production activation remains blocked. No production or snake-test access occurred.

2026-11-08: full application/static suite 499/499; focused final regression run
58/58; TypeScript noEmit passed; focused lint passed; repository lint exited 0
with 29 warnings outside the changed implementation; diff/whitespace checks passed.
No build/deployment or database connection was needed for this local validation.
PostgreSQL execution and lock/rollback fixtures subsequently passed as recorded above.
Production performance, recovery and operational rollout remain separate responsibilities.

Changed/added for this task (existing unrelated Viper work is preserved):

```text
supabase/migrations/20261108170000_sku_independent_catalog_identity.sql
supabase/migrations/20261108170100_viper_optional_sku_compatibility.sql
lib/shopify/sync-persistence.ts
lib/shopify/sync-persistence.test.ts
lib/shopify/sync-recovery.test.ts
lib/shopify/backfill-proof.ts
lib/shopify/backfill-proof.test.ts
lib/intelligence/roy/catalog-semantics.ts
lib/intelligence/workforce/contexts/shopify-catalog-provider.ts
scripts/roy-phase2a/database-acceptance.mjs
tests/catalog-identity.integration.test.mjs
tests/digital-workforce-roy-product-variant-semantics.test.ts
tests/database/catalog-identity.dynamic.sql
tests/database/catalog-viper-sales.dynamic.sql
tests/database/catalog-concurrency-setup.sql
tests/database/catalog-concurrency-writer.sql
tests/database/catalog-concurrency-completion.sql
tests/database/catalog-concurrency-cleanup.sql
tests/database/roy-phase-2a-sync-persistence.dynamic.sql
tests/database/roy-phase-2a-backfill.dynamic.sql
tests/database/roy-phase-2a-upgrade-seed.sql
tests/database/roy-phase-2a-upgrade-assertions.sql
docs/catalog-sku-independent-identity.md
```

Lock-mode rationale follows PostgreSQL 17's
[explicit locking contract](https://www.postgresql.org/docs/17/explicit-locking.html).
