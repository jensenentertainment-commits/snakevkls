# Roy Phase 2A Commit 8: protected backfill and independent proof

This is operator tooling and forward database artifacts, not a production rollout.
No deployment, migration, source traversal, reconciliation, checkpoint reset or
Roy gate activation is triggered by building or deploying this commit.

**Executable PostgreSQL validation: NOT RUN — isolated database target unavailable.**
The code/static tests below do not establish database transactional correctness.
Commit 2 and Commit 5–8 execution remains a production-readiness gate. Neither
TV19 nor production vk-lager is an approved destructive test target.

## Architecture

`start_shopify_backfill_v1` takes the existing global Shopify advisory lock. It
rejects any unfinished running, paused or failed run, then uses the existing
claim implementation to admit a genuinely fresh run (zero pages, null cursor).
It binds that run permanently to a caller-supplied operation UUID and explicit
target/code/contract identity, and immediately pauses it. Retrying the same
operation/identity returns the existing run; identity changes reject. Start does
not fetch Shopify. Existing checkpoints are never reset or adopted as backfill.

The forward migration moves the six existing claim/write/complete/pause/fail
implementations intact into `private` and preserves their public signatures as
guarded wrappers. Their private implementations are not executable by API roles.
Ordinary cron/manual claims return `acquired=false` while a protected run is
unfinished, even after its lease expires. Ordinary direct writes, failure/pause
and completion reject protected runs. This is an operational fence for trusted
service workers, not a defense against a database owner or stolen service key.

Confirmed `resume` uses the existing Shopify source, cost/throttle handling,
collection pagination, mapping, page normalization and recovery engine. It uses
20 variants per catalog page and deduplicates product collection traversal within
each page, without caching across pages. The bound worker claims/reclaims only
its run. Each invocation defaults to one page and accepts at most 20 pages, with
the existing duration/lease deadlines. Shopify requests are queries only.

`apply_shopify_backfill_page_v1` locks the operation and calls the existing V2
writer exactly once. The same transaction:

1. Validates operation binding and bounded terminal collection evidence.
2. Computes expected canonical, variant and legacy projections from fresh source
   payloads, including explicit missing values and complete-zero membership.
3. Applies V2 with its cursor, page-count and lease fencing. V2 calls the retained
   legacy writer; there is no second canonical persistence implementation.
4. Compares database projections to source expectations and verifies retained
   local variant identity where it existed before the page.
5. Inserts a bounded durable page receipt alongside the checkpoint.

Any failure, including receipt insertion or projection disagreement, rolls back
canonical content/membership, variants, legacy collections, seen IDs, counters,
timestamps and checkpoint together. Failed/incomplete traversal does not enter
this transaction and cannot erase an earlier complete canonical snapshot.

`products` remains variant authority. SKU fallback/preservation, no-SKU skipping,
price, Shopify inventory and per-variant legacy relation counters stay with the
existing writer. Physical warehouse inventory is not written. Lager, Viper,
Lagersalg, Roy provider/context/presentation and received fields are unchanged.

## Completion hold and recovery

After the final page commits with `hasNextPage=false`, the protected engine
pauses and reports `completion_hold`. Resuming that run does not fetch another
page or reconcile. Ordinary sync retains normal automatic completion.

`preview_shopify_backfill_v1` uses the exact normal completion predicate: every
Shopify-linked variant not seen in this run, including already-inactive rows.
It reports updated-row count, active deactivations, at most 24 local-ID examples
and a digest of the ordered affected population. These are restricted operator
data, not model evidence. The operator saves and reviews this preview separately.

Confirmed completion takes the advisory/operation locks, freezes product writes
for the short reconciliation transaction, requires the exact unchanged preview
and complete page receipt count, reclaims a lease, and invokes normal completion.
It stores the approval and completion time in the same transaction. A changed
preview rejects and requires a new review. The same successful approval is
idempotent after a lost acknowledgement; a different approval rejects.

Ambiguous page transport outcomes use `recover_shopify_backfill_v1`: it locks the
bound operation, reads authoritative run state, and records a bounded recovery
read count/latest checkpoint. The worker stops for reclaim; it never assumes
rollback or replays blindly. If recovery is unavailable, leave the lease to
expire and inspect/resume the same operation/run. Start/complete transport
failures likewise require inspection of that identity, then an identical retry.
Incomplete/held operations are proof blockers. There is deliberately no command
to discard a protected run, reset history, bypass reconciliation approval or
automatically restore old data. Such exceptional recovery needs separate review.

## Provenance and corrections

`private.shopify_backfill_operations` stores operation/run identity, exact code
revision and contract version, store/location, operator gate attestation,
admission/completion times, claim/recovery counts, latest recovery checkpoint,
approved preview, admission function-definition hashes and physical-inventory
baseline digest. `private.shopify_backfill_pages` stores contiguous page numbers,
expected/next cursors, final-page flags, commit times and normalized payload
digests. Each receipt contains bounded per-product content/membership digests,
observation times, member counts, collection page counts, explicit terminal
`false` evidence and a rolling digest of collection cursor observations; it also
contains per-variant expected digests/skip decisions/legacy relation counts.

Receipts are at most 64 KiB each, with at most 20 source products and variants;
cursor values are at most 4 KiB. Their number grows with processed pages, not with
retries. Full descriptions and collection arrays are not retained in receipts.
SHA-256 payload/fact hashes use PostgreSQL UTF-8 `jsonb::text` serialization, with
UTC timestamps and collection-ID ordering. The client collection cursor digest
uses SHA-256 over the prior digest plus JSON of each observed page. These distinct
digest formats are intentional; do not compare PostgreSQL and JavaScript JSON
serializations as though they were identical. They attest trusted source-path
execution, not a Shopify-signed snapshot or an adversarial database-owner audit.

Collection observation time is now captured after the final successful page,
including complete zero. Failed traversals retain UNKNOWN/incomplete semantics.
`contentObservedAt`, Shopify `updatedAt` and database persistence time remain
separate. The protected writer rejects observations predating its admission or
collection completion predating content observation; investigate operator/DB
clock skew rather than fabricating timestamps. Shopify may change during a
traversal: completeness proves terminal pagination over the recorded interval,
not a frozen live Shopify snapshot.

The category CHECK is corrected in a new forward migration with `(... ) IS TRUE`
and ECMAScript Unicode whitespace handling. Half-null ID/name pairs cannot pass
via SQL UNKNOWN. Valid null/null and valid category pairs remain accepted.
Existing malformed data makes migration validation fail; no automatic data
repair is included. Historical migrations remain untouched.

## Commands and operator safety

Commands below describe later, separately approved use. None were executed
against a database during Commit 8. Use a clean checkout at the approved commit.
Keep target/preview/export files outside the checkout in a restricted directory.
No `.env` files are loaded by this CLI. Supply `PHASE2A_SERVICE_ROLE_KEY` through
approved secret handling; never put keys in arguments, reports or Git.

The target JSON has exactly these keys (replace placeholders; they are not valid
execution inputs):

```json
{
  "projectRef": "<20-character approved project ref>",
  "supabaseUrl": "https://<same-ref>.supabase.co",
  "shop": "<approved-store>.myshopify.com",
  "locationId": "gid://shopify/Location/<approved-id>",
  "codeRevision": "<40-character approved HEAD>",
  "contractVersion": "phase2a_backfill_v1",
  "runtimeGateDisabled": true
}
```

The project URL must exactly match its reference. Mutations require a clean
checkout matching `codeRevision`, local gate disabled, store/location agreement,
required RPC presence and exact confirmation. Gate attestation does **not** prove
the deployed environment is disabled: independently verify that before approval.
Preflight reports database/server identity, required migration artifact versions,
function definition hashes, category constraint, proof availability, source
connection presence, gate limitation and resumable/protected state. Listed
migration versions are dependencies, not a claim about the remote migration
ledger. Compare the ledger and function hashes with the isolated validated
release before rollout. No credentials or lease tokens are printed.

```text
npm.cmd run roy:phase2a
node scripts/roy-phase2a/cli.ts plan --target <target.json>
node scripts/roy-phase2a/cli.ts start --target <target.json> --operation <OP> --confirm "START <OP> <REF> <SHOP>"
node scripts/roy-phase2a/cli.ts resume --target <target.json> --operation <OP> --run <RUN> --max-pages 1 --confirm "RESUME <OP> <RUN>"
node scripts/roy-phase2a/cli.ts inspect --target <target.json> --operation <OP>
node scripts/roy-phase2a/cli.ts preview --target <target.json> --operation <OP>
node scripts/roy-phase2a/cli.ts complete --target <target.json> --operation <OP> --run <RUN> --preview <reviewed-preview.json> --confirm "COMPLETE <OP> <RUN> <AFFECTED_DIGEST>"
node scripts/roy-phase2a/cli.ts proof --snapshot <restricted-snapshot.json> --format json
node scripts/roy-phase2a/cli.ts proof --snapshot <restricted-snapshot.json> --format text
```

Default invocation prints read-only help; `plan`/`preflight`, `inspect` and preview
only read. Unknown/duplicate flags and non-exact confirmations reject. `proof`
is offline and needs no credentials. Exit codes are 0 for a successful command
or passing data proof, 2 for FAIL/BLOCKED proof, and 1 for rejected/unresolved
commands. A passing data proof is **not** activation approval. Errors deliberately
omit provider messages that could contain credentials; inspect bound state.

## Independent proof

Later, an explicitly approved read-only database session runs
`scripts/roy-phase2a/proof-snapshot.sql`. It requires an operator connection allowed
to invoke the restricted oracle and `SET ROLE authenticated`, plus an explicit
active admin/user profile UUID. Supply connection credentials securely, not in
the command line. Use `psql -X -qAt -v ON_ERROR_STOP=1 -v operation=<OP>
-v profile=<PROFILE> -f scripts/roy-phase2a/proof-snapshot.sql`, capturing UTF-8 JSON
to a restricted file. This requires a separately available psql; Commit 8 does
not install it. The SQL transaction is REPEATABLE READ, READ ONLY, and rolls back.

The service-only oracle directly queries database facts without calling Roy
RPCs. The export then changes to `authenticated` and invokes both Roy readers
under the supplied profile's actual authorization/RLS in that same snapshot.
It never grants service-role access to Roy retrieval. Raw exports may contain
restricted operational IDs and the existing bounded targeted text previews;
keep them out of model context. Reports contain counts/checks, not raw payloads.

The offline evaluator produces versioned JSON and human text with explicit
PASS/FAIL/BLOCKED checks. It compares exact active Snake product/variant counts,
observation coverage, all eight field-state partitions, collection partitions
(including no-row versus incomplete-row and complete zero), and descriptive
timestamp populations/ranges with the independent oracle. The active authority
is `products.active=true AND shopify_product_id IS NOT NULL`, not stored canonical
status or independently verified live Shopify totals. Vendor is not a finding.

It verifies contiguous receipt/checkpoint coverage and terminal state, latest
per-product content/membership and per-variant legacy projections, counters,
unattributed active products, reconciliation and physical-inventory baseline.
Latest receipts are selected separately by product and variant: fresh legitimate
source changes across pages are not compared blindly against historical values.
A changed physical-inventory digest is BLOCKED pending independent attribution,
since ordinary warehouse activity may legitimately change it.

At most eight deterministic target samples are allocated round-robin across
unknown content, incomplete membership, complete zero, over-24 collections,
over-25 variants, missing fields and otherwise-present buckets. Stable product
ID/SKU/local ID order fixes ties; IDs remain internal. Target checks compare field
states, variant count, selected price/quantity/tracking and canonical member count.
Existing strict readers validate no technical-ID leakage, byte limits and explicit
truncation: aggregate 8 examples/finding, 24 total, 32 KiB; targeted 24 siblings,
24 names, 32 KiB. The oracle is bounded to 64 KiB and input export to 512 KiB.
Empty catalogs remain representable. Nonempty catalogs without eligible samples
block proof. Missing/malformed artifacts reject or fail, never produce PASS.

The fixed snapshot input digest makes reruns reproducible. Freshness has no stale
threshold or score. Live concurrent source edits and changes after the snapshot
remain limitations. Keep ordinary sync quiescent through post-completion export
under a separately approved rollout procedure; later writes may invalidate the
receipt agreement. The output preserves the current NOT RUN database-validation
classification and a separate activation block, even if data checks pass.

## Migration order and later rollout gates

On an already compatible database, apply repository migrations in order. These
Phase 2A dependencies are additive to the existing baseline/auth/roles/sync/
warehouse catalog migrations, not a standalone bootstrap:

1. `20260907195256_phase_2a_product_content_foundation.sql` (Commit 2).
2. `20260917192405_phase_2a_transactional_sync_persistence.sql` (Commit 5).
3. `20260917200011_phase_2a_catalog_foundation_rpc.sql` (Commit 6).
4. `20260919090000_phase_2a_roy_targeted_reader.sql` (Commit 7).
5. `20260919093000_phase_2a_protected_backfill.sql` (Commit 8 control/correction).
6. `20260919094000_phase_2a_backfill_proof.sql` (Commit 8 oracle).

The later rollout requires separate approval at each production boundary:

1. Obtain an isolated disposable PostgreSQL environment compatible with the
   Supabase baseline/roles/extensions and real independent concurrent sessions.
   Execute all migration, rollback, constraint, RLS and concurrency fixtures.
   Record exact revision, migration hashes, commands and results. Run query plans
   at representative catalog size; do not add speculative indexes.
2. Approve a production change window. Keep the Roy gate off and quiesce/drain
   ordinary sync workers before migration/guard installation. Check existing
   resumable runs and category validity read-only. Complete old runs through their
   approved normal path; never reset them for canonical coverage. Apply reviewed
   migrations only after executable validation and explicit production approval.
3. Verify migration ledger, functions, privileges, category CHECK and disabled
   deployed gate. Smoke-test reads with the authorized profile and denied roles.
4. Separately approve an explicit fresh protected operation and repeated bounded
   resumes. Previously checkpointed older pages become populated only through
   this new source traversal. Review final reconciliation preview before approval.
5. Export the same-snapshot proof, inspect all exact counts and checks, retain
   restricted provenance and independent evidence. Unknown active legacy rows
   are blockers for review, not candidates for fabricated observations.
6. Perform separately controlled targeted conversational smoke tests without a
   general production gate activation. Verify existing Phase 0/1 behavior too.
7. Require explicit activation approval after all database, population, proof,
   security and conversational gates pass. Commit 8 never enables the gate.

Recovery: migration failure must roll back its transaction; inspect before retry.
Do not drop canonical tables or blindly reverse a partially populated rollout.
During source/persistence failure retain earlier complete snapshots and resume
the same protected run. A changed completion preview requires new approval.
After completed reconciliation, restoring business data requires a reviewed
recovery/forward-correction plan; there is no automatic destructive undo. A proof
failure keeps Roy disabled. Resolve discrepancies with independent facts and,
where needed, a separately approved new source run.

## Executable fixture plan (prepared, NOT RUN)

Minimum capability: an isolated PostgreSQL database named
`snake_phase2a_test` or `snake_phase2a_test_<suffix>`, explicit session setting
`snake.phase2a_isolated=on`, baseline-compatible roles/auth helpers/extensions,
DDL/fixture permissions, psql and at least two independent sessions. Database
name/opt-in guards precede fixture writes. They are defense in depth, not proof
that a supplied target is safe. Verify the target before any bootstrap/migration.
`supabase-local-bootstrap.sql` itself must only run after that verification.

On fresh migrated isolated databases run the existing Commit 5 persistence,
Commit 6 aggregate and Commit 7 targeted dynamic/concurrency suites, then
`tests/database/roy-phase-2a-backfill.dynamic.sql`. The dynamic suite rolls back
its fixtures. It covers old-run blocking, binding/idempotency, service permissions,
ordinary-worker fencing, receipt fault rollback, replay, incomplete refresh,
complete-zero, hold/recovery, stale-preview rejection, approved completion,
independent mixed-population oracle agreement, bounds and category NULL failures.

For admission races, run `roy-phase-2a-backfill-concurrency-setup.sql`, launch
`roy-phase-2a-backfill-concurrent-call.sql` in two independent sessions with
`worker=a` and `worker=b`, then run the assertions file. Repeat on a fresh isolated
fixture database with `worker=a` and `worker=ordinary`. These fixtures intentionally
commit setup/results so sessions can see them. Use isolated disposal afterward;
never transplant their setup/cleanup into production. Existing V2/reader suites
must also run against the guarded migration to verify unchanged nested behavior.

## Local validation and exact file inventory

Code tests cover confirmations/target identity, read-only defaults, shared-source
deduplication/receipt evidence, held final pages, lost acknowledgements and strict
negative proof cases. SQL/security checks are static contract assertions only.
Final commands: focused Shopify/backfill tests, full `npm.cmd test`, TypeScript,
`npm.cmd run lint`, `npm.cmd run build`, unstaged/staged `git diff --check`.
Results are recorded in the Commit 8 completion report; executable PostgreSQL
remains **NOT RUN — isolated database target unavailable**.

Final local results: 96 focused Shopify/backfill/static SQL tests and all 416
full-suite tests passed (22 tests added over Commit 7). TypeScript passed with
incremental checking disabled. Lint passed with zero errors and 29 pre-existing
warnings, none in Commit 8 files. The local production build passed, including
TypeScript and all 27 static pages; network access was used only for the existing
Google Fonts build dependency. Unstaged and staged whitespace checks passed.
These results do not imply migrations were applied or database fixtures executed.

Modified files:

- `lib/shopify/catalog-source.ts`
- `lib/shopify/collection-pagination.ts`
- `lib/shopify/collection-pagination.test.ts`
- `lib/shopify/sync-engine.ts`
- `lib/shopify/sync-recovery.test.ts`
- `package.json`

Added files:

- `docs/roy-phase-2a-backfill.md`
- `lib/shopify/backfill-operation.ts`
- `lib/shopify/backfill-operation.test.ts`
- `lib/shopify/backfill-proof.ts`
- `lib/shopify/backfill-proof.test.ts`
- `scripts/roy-phase2a/cli.ts`
- `scripts/roy-phase2a/proof-snapshot.sql`
- `supabase/migrations/20260919093000_phase_2a_protected_backfill.sql`
- `supabase/migrations/20260919094000_phase_2a_backfill_proof.sql`
- `tests/database/roy-phase-2a-backfill.helpers.sql`
- `tests/database/roy-phase-2a-backfill.dynamic.sql`
- `tests/database/roy-phase-2a-backfill-concurrency-setup.sql`
- `tests/database/roy-phase-2a-backfill-concurrent-call.sql`
- `tests/database/roy-phase-2a-backfill-concurrency-assertions.sql`
- `tests/roy-phase-2a-backfill.integration.test.ts`
