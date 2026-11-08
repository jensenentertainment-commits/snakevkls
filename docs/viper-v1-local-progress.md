# Viper 1.0 — local implementation

Production vk-lager is unchanged. No production migration, deployment, commit,
push, Shopify mutation, catalogue-sync repair or real stock/location update.

## Step 1 — approved and database validated

20261103215816_viper_shared_location_validation.sql extracts the authoritative
PICK/BUFFER/single-location selection into validate_viper_order_lines(jsonb).
Preview and materialization use the same resolver and shared Shopify source mapping.
The resolver preserves exact variant/SKU identity and physical picking order,
rejects ambiguity, insufficient stock, inactive locations/zones and missing order.

The local Windows PostgreSQL server setup was blocked by Application Control;
no bypass was attempted. Testing now uses only the approved managed snake-test
project mvwpbscexvnfavxhbexb, direct host db.mvwpbscexvnfavxhbexb.supabase.co,
port 5432, database/user postgres, TLS verify-full with the Supabase CA and system
identifier 7702071863184491885. No production credentials are used. Managed auth
and roles are retained; the local auth bootstrap must never run here.

Step 1: all 30 baseline/forward migrations and the rollback fixture passed.
Evidence: viper-step1-20261104T054927Z.json in the restricted local
SnakeViperValidation/supabase-test directory.

## Step 2 — fenced commands and recovery

Forward migration: 20261104062000_viper_fenced_pick_commands.sql.
The public apply_viper_pick_command RPC is SECURITY INVOKER, empty search_path,
service_role-only. It independently checks active profiles, ownership and admin
rights. The actor is derived by authenticated server routes, never from client JSON.

All commands acquire job -> order -> lines (ordered UUID) -> exceptions (ordered
UUID) -> inventory when completing. Start alone retains the existing pilot
admission advisory lock, taken BEFORE the job. The one-active-job index remains.
No new global lock prevents a later, separately designed multi-picker model.

The five existing mutation functions move into the unexposed private schema as
internal INVOKER helpers, preserving the existing completion implementation.
service_role has explicit private-schema usage. These helpers remain callable by
the trusted database service role; application code must exclusively use the public
command RPC. Existing public unfenced RPCs no longer exist. Deployment therefore
requires coordinated application/schema rollout; older application mutations fail
closed. Nothing in this local work authorizes that rollout.

Each job has an integer version. Commands require the displayed expectedVersion
and a client command UUID. The private, RLS-enabled receipt table binds the UUID to
job, actor, action, expected version and exact payload. An identical replay returns
its stored result even after later corrections; it never re-applies old picking.
Reusing an ID with changed contents or sending a stale version fails. Version,
domain updates, audit and receipt commit or roll back together. The client retains
the command ID for an identical transport retry and refreshes authoritative state.

- Undo: owner only, in-progress picked line -> pending; clear picked fields.
- Cancel: owner or admin, ready/in-progress -> cancelled. Clear line confirmations,
  close open exceptions with explicit cancellation reason, retain history/identity.
- Reprepare: admin only, cancelled -> ready on the SAME job/order/lines/locations;
  no stock movements may exist, assignment/start fields reset. No source refresh.
- These corrections require a reason and explicit physical-return confirmation.
  They never change inventory. Real returned goods must match the confirmation.
- Closing the browser is a pause, not cancellation. The owner can reopen their
  active job. Admin recovery is available for a genuinely abandoned/stuck job.
- Completed jobs cannot be undone, cancelled or reprepared. Completion keeps the
  original atomic stock validation, deduction and movement log.

UI: current picker has an optional correction form and status refresh. Admins can
open /viper/admin/recovery from the queue or exceptions page. The bounded list
prioritizes the active job, then oldest cancelled jobs (100 maximum). Repreparing
an old cancelled job removes it from this list. No scanning, automatic queue,
reservations, split picking or Shopify fulfillment was added.

## Step 2 validation and retained evidence

The dedicated step2-acceptance.mjs uses the same exact host/TLS/system-ID guards.
--apply-step2 applies ONLY the new migration to the already validated step-1
schema; --verify-step2 runs fixtures on that schema without reapplying migrations.
Both require the explicit snake-test confirmation and a new absolute evidence path.
They do not read .env files, provision targets, reset databases or use pooler auth.
Synthetic application/auth populations must be empty before execution.

Database checks include:
- Step-1 resolver/import/rollback regression after the new migration.
- Real service_role execution; unauthorized function privileges, wrong owner and
  non-admin recovery rejection; version and command-reuse rejection.
- Confirm, undo, exception block/resolve, cancel/reprepare, retained identities,
  physical-return/reason enforcement and audit records.
- Lost-acknowledgement replay after undo and completion; one stock deduction.
- Injected receipt failure after start AND completion rolls back domain effects,
  inventory, events and version. One active pick remains enforced.
- Independent-session report/resolve races: observe B waiting on A's job lock,
  then A obtains child locks with NOWAIT. This detects the old inversion without
  depending on deadlock timing. The waiting stale operation fails after A commits.
- Completion versus cancellation: one succeeds, the stale cancellation fails,
  one movement/deduction exists. Synthetic teardown and final empty checks pass.

Evidence files in the restricted local supabase-test directory:
- viper-step2-20261104T194315Z.json: migration + initial dynamic suite PASS.
- viper-step2-20261104T194542Z.json: races passed, final verification had a runner
  syntax error (a dollar-quote delimiter generated as a single dollar). Cleanup
  succeeded. Failure evidence retained; assertions were not weakened.
- viper-step2-20261104T194727Z.json: corrected complete run PASS, including extra
  completion rollback and single-active assertions. All synthetic rows removed.

Schema and historical synthetic HL/ML/SL prerequisites remain on snake-test.
No retained Roy validation target was touched. Temporary direct-host password files
are removed in finally; the original restricted credential file remains unchanged.

## Remaining boundary

At the step-2 approval boundary, step 3 remained: fresh stock/location checks at start and fresh Shopify
eligibility/version checks at start/first completion. V1 will conservatively reject
changed source versions unless a separately approved fingerprint is introduced.
Reprepare does not establish that Shopify is unchanged. Do not pilot on real orders
until step 3 and the final operational verification are approved and completed.

Physical-return confirmation is an operator assertion; software cannot verify
that goods were physically put back. Admin must coordinate with the picker before
cancelling. Manual browser/device usability validation remains before pilot use.
The wider step-4 operational/concurrency matrix remains separate from step 2.

## Final local checks, 2026-11-04

439 application/static tests PASS; TypeScript PASS; targeted Viper ESLint PASS
without warnings; full lint has zero errors and 29 pre-existing warnings in
unchanged files. Production build PASS after enabling network access for the
existing Google Fonts dependency (initial sandbox build could not fetch fonts).
Git diff --check PASS. React skill review covered labelled correction inputs,
server authorization, per-component retry identity and completed-job controls.
No authenticated browser/manual physical pilot test was claimed.

Worktree retains the approved step-1 work plus uncommitted step-2 changes.
Staging is empty. No commit, push, production migration or deployment performed.

## Step 3 — validated 2026-11-04

Migration: 20261104201000_viper_fresh_start_completion.sql. Start and first
completion require a fresh server-supplied Shopify observation. HTTP timeout is
10 seconds, observations are accepted for 30 seconds (maximum 5 seconds future
clock skew). Age is checked again after database lock waits. Client-supplied
observation fields are not trusted: the route builds requested_source itself.

The server checks cancellation, payment/fulfillment eligibility, complete line
retrieval and exact imported updatedAt (timestamp equivalence). This is deliberately
conservative: metadata-only Shopify updates also block V1. Database validation
compares exact imported line IDs, variant IDs, SKUs and quantities. Shopify calls
finish before entering the mutating transaction; no database locks span HTTP.

The transaction retains job/order/line/exception ordering, including shared locks
on source order_lines. Product, location and zone reference rows are share-locked;
products precede inventory consistently with existing warehouse upsert order.
Inventory rows are locked in stable ID order. It revalidates active status,
identity, fixed location, quantity and current physical ordering. There is no
automatic rerouting, split picking, stock reservation or fulfillment.

The read-only get_viper_pick_command_result RPC recovers exact stored command
receipts before Shopify access. An owned completed job can also be recovered after
page reload without Shopify availability. Normal corrections still use the step-2
command/receipt implementation. Source verification audit and stock completion
are in one transaction; audit failure rolls back the deduction.

Executable evidence, restricted local SnakeViperValidation/supabase-test:
- viper-step3-20261104T195624Z.json: initial suite PASS.
- viper-step3-20261104T195843Z.json: fixture-only editing defect; completion was
  incorrectly attempted before start. Correctly rejected; transaction rolled back.
- viper-step3-20261104T201657Z.json: final suite PASS, including corrected fixture,
  order-line locking, corrections regression, source-audit fault rollback,
  permission checks and clean-population verification.

Concurrent sessions verify that inventory changes, location deactivation and
order-line changes committed while validation waits cause rejection with no job
advance or stock deduction. Report/resolve lock-order and completion/cancellation
races also pass. Step-1 import regression passes after the new migration.
Synthetic rows are removed; schema and historical synthetic baseline remain.
The new function was refreshed only in snake-test during local iteration; all
historical migration files are unchanged.

Local validation: 444 tests PASS; TypeScript PASS; production build PASS; lint
0 errors / 29 unchanged warnings; diff whitespace check PASS. Shopify error and
eligibility tests use synthetic responses; no real Shopify order or production
connection was used for testing.

Remaining limitations before pilot approval:
- Shopify and PostgreSQL have no shared transaction. A remote order can change
  AFTER the last Shopify response. No claim of distributed atomicity is made.
  Operators must not edit/fulfill the Shopify order while finishing the Snake pick.
- Changed Shopify orders remain blocked. Cancellation and physical return work;
  reprepare does not replace the imported source version. No automatic re-import
  or order refresh is included. Such orders need the existing manual operational
  handling outside this picking flow, not a bypass of validation.
- Fresh stock checks are not reservations. Stock can change during physical picking;
  completion rechecks and fails atomically if insufficient.
- Step 4 and mobile/browser/physical pilot verification remain. No step 4 work,
  production migration, commit, push or deployment is authorized by this report.

## Step 4 — consolidated acceptance, 2026-11-04

No runtime functionality or UI changes were needed during step 4. Added the
multi-line import-to-completion SQL acceptance fixture, explicit permission tests,
source-failure pipeline tests and a read-only-schema step-4 acceptance runner.
The concurrency harness additionally tests two simultaneous completions, proving
that the second recovers completed state without a second stock deduction.

Evidence: viper-step4-20261104T202218Z.json in the restricted local
SnakeViperValidation/supabase-test directory. PASS, full TLS verify-full and expected
system ID verified. First consolidated run also passed (20261104T202049Z).
Synthetic application/auth rows were removed and final population checks passed.
No production project or real Shopify order was accessed. The complete tested flow
is SQL materialization/picking with synthetic source data plus mocked source/API
failure tests, not a live authenticated browser-to-Shopify test.

446 application/static tests PASS; TypeScript PASS; production build PASS;
lint 0 errors / 29 pre-existing warnings; git diff --check PASS. No new runtime
corrective migration was required. See viper-v1-operations.md for migration order,
rollback/change-window boundaries, role model, operator recovery and pilot gates.

Stop after step 4. Current-UI review is the next separately approved task; no UI
redesign, production schema/deployment/activation, commit or push performed.
