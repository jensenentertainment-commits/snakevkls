# Roy Phase 2A completion-review forward fix

This change corrects protected claim locking and prepares executable acceptance.
It does not activate Roy, apply migrations, populate a catalog or provision a
database. **Executable PostgreSQL validation: NOT RUN — isolated database target unavailable.**

## Correction

Apply `20260920120000_phase_2a_protected_claim_lock_order.sql` after the Commit 8
proof migration. Historical migrations are unchanged. Protected claim retains
the global admission advisory lock, validates confirmation, locks the matching
operation row, then calls the existing private run claimant. Protected page and
claim now both acquire **operation → run**. Terminal holds, lease duration/token
fencing, identity, ordinary-worker exclusion and service-only grants are unchanged.
The V2 writer, readers, runtime, proof contracts and canonical semantics are unchanged.

The final-schema aggregate fixture now checks both half-null category pairs for
`23514` / `check_violation`, and verifies the named category constraint. A separate
subtransaction removes that constraint only inside an isolated fixture, introduces
malformed data and requires the reader's exact `22000` rejection. That exception
rolls back both the data and DDL; the test asserts the constraint is restored.

## Prepared acceptance matrix

`scripts/roy-phase2a/database-acceptance.mjs` defaults to offline plan output.
Importing it or running application tests never opens a database connection.
Later execution requires an already approved, empty disposable database, existing
psql, an administrative fixture role, an explicit loopback host/port, database
name `snake_phase2a_test` or `snake_phase2a_test_<suffix>`, and exact confirmation.
It rejects service/host indirection and overrides inherited PGOPTIONS. Every SQL
entry has the database-name/session opt-in guard. The runner refuses an existing
application/auth/private schema before bootstrap. These controls cannot certify
that a database is disposable: an operator must verify the target independently.

No database, container, branch or tooling is created. Bootstrap creates only the
existing test auth/role shim within the approved fixture environment. Each real
migration runs under `psql -1` with `ON_ERROR_STOP`; hashes are retained in output.
There is no schema reset, automatic retry, or production migration command.

Use two separate fresh disposable targets for these matrices:

| Matrix | Executable path |
| --- | --- |
| `fresh` | Bootstrap → every repository migration in order → existing four dynamic suites → protected recovery/concurrency/completion → actual SQL export and offline proof |
| `upgrade` | Bootstrap → migrations through Commit 2 → synthetic V1 page and paused old checkpoint plus historical canonical row → Commit 5–7 → expect real Commit 8 category migration rejection → assert full rollback → explicitly repair only the synthetic malformed row → remaining migrations → resume exact old checkpoint with V2 → assert old coverage remains UNKNOWN, historical identity/seen IDs survive and handle reassignment works → same final-schema suites/recovery/proof |

The upgrade fixture removes only its named synthetic rows and test helper schema
after its assertions, allowing the existing empty-catalog suites to run against
the upgraded schema. This is not a production checkpoint reset mechanism.
Other concurrency fixture setups intentionally commit state; do not mix them into
these two databases or reuse a failed/partially executed matrix target.

Future commands, **not executed for this fix**:

```text
node scripts/roy-phase2a/database-acceptance.mjs --plan
node scripts/roy-phase2a/database-acceptance.mjs --execute --matrix fresh --database snake_phase2a_test_fresh --confirm "EXECUTE ISOLATED fresh snake_phase2a_test_fresh"
node scripts/roy-phase2a/database-acceptance.mjs --execute --matrix upgrade --database snake_phase2a_test_upgrade --confirm "EXECUTE ISOLATED upgrade snake_phase2a_test_upgrade"
```

Set PGHOST to the approved loopback endpoint, PGPORT explicitly, PGDATABASE to the
exact named target, and PGUSER to its isolated administrative role. Use approved
PGPASSFILE or secret handling for credentials, never command arguments. No .env
files are loaded. Keep JSON results restricted and retain revision, migration
hashes, PostgreSQL version and invocation/environment identity separately. An
error exits nonzero; it never produces a successful acceptance report.

## Deterministic concurrency and recovery

The new reclaim test uses two independent sessions and observable lock barriers,
not a sleep-based guess about which session ran first:

1. The page session locks the bound operation and publishes a fixture advisory barrier.
2. The runner starts reclaim only once that barrier is visible.
3. The page session waits until `pg_blocking_pids` proves reclaim is blocked by it.
4. It acquires the run with `FOR UPDATE NOWAIT`. The historical implementation
   already holds that run while waiting for the operation, so this assertion fails
   immediately. The corrected claimant has not locked the run and the assertion succeeds.
5. The actual expired-token page RPC is rejected without page/receipt effects;
   releasing the operation lets reclaim issue a fresh fenced token.

Timeouts bound every wait. A failed assertion does not count as passing because
PostgreSQL happened to choose a deadlock victim. The fixture adds no production hooks.

The same protected run then covers:

- Ordinary claim/V1/V2/pause/fail/complete exclusion after lease expiration,
  including unchanged canonical, variant, checkpoint, operation and receipt state.
- Real page execution inside an uncommitted transaction. The runner terminates
  only its specifically named, barrier-holding backend in the current isolated
  database. A new connection verifies full rollback and reads persisted recovery state.
- A real committed final page whose response is deliberately discarded. A new
  connection recovers the persisted terminal checkpoint; replay cannot duplicate
  receipts or counters, and claim returns completion hold. This models a lost
  acknowledgement; it is not a network-proxy fault test.
- Failure injection at run completion and at the subsequent approval write,
  asserting reconciliation, completion, approval, lease and receipts all roll back.
- Two overlapping completion RPCs synchronized by real blocking. One commits;
  the other returns the same completed result. A later independent retry models
  a lost completion acknowledgement. Persisted approval, run and reconciliation
  are asserted together.
- The actual `scripts/roy-phase2a/proof-snapshot.sql` export, including authenticated
  reader execution in its read-only repeatable-read snapshot. Its JSON is fed
  directly to the existing offline evaluator, which must return data-proof PASS.
  The evaluator's separate activation/database-validation labels remain unchanged;
  the matrix result is a separate executable validation artifact, never activation approval.

## Existing suites still required

The runner executes existing persistence, aggregate, targeted and backfill dynamic
suites on both paths. Also execute the already prepared independent-session suites
on separate freshly migrated disposable databases, using their documented entry
points: V2 duplicate-page race, aggregate concurrent reads/writes, targeted
concurrent reads/writes, protected-versus-protected admission and
protected-versus-ordinary admission. See the transactional persistence, catalog
foundation, context integration and backfill runbooks. No fixture set establishes
actual PostgreSQL behavior until it is executed. Representative query-plan checks
and production-specific schema/RLS smoke verification remain later gates.

## Validation and next gate

Application/static checks verify the guarded default, strict target parsing,
lock-order/security contract, precise category exceptions, fixture guard chains,
and acceptance orchestration. They do not execute SQL or prove its correctness.
Local validation: 40 focused tests and all 425 application/static tests passed;
TypeScript passed with incremental output disabled. Lint passed with zero errors
and 29 existing warnings (none in changed code). The production build passed,
including all 27 static pages, after retrying with network access for the existing
Google Fonts dependency. Diff whitespace checks passed. No PostgreSQL fixture,
migration or database acceptance command was executed.

Before execution: approve this fix, provide/approve an isolated target and existing
client, verify its identity and fixture-role permissions, and record the complete
matrix/suite plan. No other infrastructure or production action is authorized by
this commit. Keep production migrations, backfill, deployment and Roy activation
blocked pending executable validation and their separate approvals.
