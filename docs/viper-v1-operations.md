# Viper 1.0 — acceptance and operational readiness

## Scope and evidence boundary

Step 4 is local/isolated acceptance, not production readiness approval or rollout.
Only snake-test mvwpbscexvnfavxhbexb is authorized for executable tests: direct
TLS verify-full, system ID 7702071863184491885, test credentials, synthetic data.
The runner refuses implicit targets and nonempty fixture populations. It does not
apply migrations, reset a database, read production environment files or call Shopify.
All fixture writes roll back, except explicit synthetic concurrency setup which is
removed by the exact guarded teardown. Failures retain evidence and stop the run.

The suite tests actual SQL import/materialization through picking and completion.
Shopify eligibility/HTTP-failure paths use synthetic responses in local tests.
This is NOT an authenticated browser-to-live-Shopify acceptance test. No real order,
production token, production schema or real warehouse stock is used.

## Coverage

- Shared preview/import resolver and source mapping; exact variant identity;
  multiple lines, physical pick ordering, PICK/BUFFER and insufficient/ambiguous
  inventory; repeated import and injected import rollback.
- Ordinary user owns picking; admin resolves exceptions/reprepares; unowned or
  stale commands fail. Actual authenticated/anon SQL execution is denied, and
  private command receipts are unreadable by authenticated users.
- Confirm, report/block/resolve, undo, cancel, admin reprepare, unchanged IDs;
  reason/physical-return controls; no deduction before completion.
- Fresh source version/line checks, missing/expired observation; changed stock,
  moved inventory, inactive product/location/zone and missing picking sequence.
- Timeout/scope/unavailable/missing/changed/cancelled Shopify outcomes stop both
  start and completion before mutation. Completed-command recovery needs no API.
- Concurrent stock/location/order-line writers; deterministic job/child lock
  regression; completion versus cancellation and simultaneous double completion.
- Command replay and single deduction; source-audit failure after deduction rolls
  back domain effects. Final fixtures leave products/orders/inventory/auth empty.

Access model: admin/user/warehouse may enter picking, but mutation ownership is
checked again in SQL against an active profile. Admin-only routes guard import,
exception resolution and reprepare. The server derives actor ID from authentication.
service_role is trusted infrastructure; private helpers are not public API and must
not be exposed as a PostgREST schema. No service key belongs in browser code.

## Migration and deployment prerequisites — no execution approved

Existing prerequisites: auth/profiles and role expansion to admin/user/warehouse;
Viper P1/P3/P4 order/pick/event/exception tables and functions; product variant
identity; warehouse inventory-integrity functions; zone pick_priority, location
pick_sequence and PICK/BUFFER purpose. Confirm these against the actual production
ledger and function definitions in a separately approved read-only rollout review.
This step did not query production and makes no assertion about its current state.

Apply the new Viper migrations in this exact order, only after separate approval:
1. 20261103215816_viper_shared_location_validation.sql
2. 20261104062000_viper_fenced_pick_commands.sql
3. 20261104201000_viper_fresh_start_completion.sql

The code depends on all three. Step 2 moves unfenced public functions into private;
step 3 wraps the fenced command with fresh source/physical checks and adds recovery.
An old app must not continue picking against the new schema. Do not run an automatic
'all pending migrations' deployment: Roy and the separate catalog-sync repair remain
out of scope. The Viper migrations do not require Roy canonical tables/RPCs directly;
any production ledger discrepancy must be reviewed, not silently reconciled.

Before production: approve a coordinated change window; capture backup/recovery
artifacts and prove restore; block new Viper operations and drain any active pick
through approved operator actions; retain source/stock/job snapshots; review exact
migration diffs; apply schema and deploy matching app in controlled order; verify
roles/RPCs and restore traffic only after smoke checks. No bulk inventory/location
changes or automatic job resets. Retain previous app and recovery evidence, but do
not simply roll back the app across incompatible RPC signatures. On failure keep
picking closed; prefer a reviewed forward repair. Never replay completed deductions.

Verify Shopify connection read_orders permission, configured shop/API version and
VIPER_SHOPIFY_IMPORT_ENABLED exact-string gate as an explicit operator decision.
No gate/configuration change is part of acceptance. Reliable catalog identity and
physically registered stock are operational prerequisites; catalog-sync repair is
separately approved work, not silently bundled into Viper deployment.

## Operator workflow

1. Admin previews/imports a small eligible Shopify order. Check quantities, chosen
   locations and physical stock. There is one active pick and one location per line.
2. Picker starts and follows physical order. Button confirmation is optional-scanner
   independent. Closing the browser pauses; reopen the assigned active pick.
3. Report an exception when physical goods do not match. Admin investigates and
   records resolution. Resolution does not itself change inventory or confirm a line.
4. Wrong confirmation: put those goods back first, select undo, give reason and
   confirm return. To abandon a job, return all withdrawn goods before cancellation.
5. A stuck job needs admin coordination with the picker. Cancel only after verifying
   return, then reprepare the same job if appropriate. Never steal an active job or
   use direct SQL as routine recovery. Reprepare retains source version/locations.
6. Finish only after all lines are picked and exceptions resolved. Snake validates
   again and deducts once. On connection loss retry the same action or refresh state;
   do not create a replacement order to guess whether completion committed.
7. Fulfill manually in Shopify AFTER confirming Snake completion. No automated
   Shopify fulfillment, queue, split picking, reservation or mandatory scan exists.

## Failure handling and limits

- Shopify unavailable: stop/retry later. No new start or first completion.
- Changed/cancelled/ineligible order: stop and coordinate with admin. Conservatively
  even metadata-only updatedAt changes block V1. Cancel/return remains available;
  reprepare does NOT refresh an altered Shopify order. Use an agreed manual process
  outside this picking flow; no automatic re-import or bypass is supplied.
- Stock/location mismatch: verify physical goods and approved warehouse records;
  do not force completion. A start check is not a reservation.
- Stale version: refresh status, coordinate with the other operator, then decide.
- Completed error: do not undo/cancel/reprepare it. Use a separately controlled
  warehouse correction with an audit trail, never a second completion deduction.
- PostgreSQL cannot lock Shopify. A remote change after the latest response remains
  possible. Operators must avoid editing/fulfilling the order during final picking.
  HTTP timeout is 10s; observation validity is 30s, rechecked after database waits.
- Physical return is an operator assertion, not electronically verified evidence.

## Remaining approval gates

Approve step-4 results, then perform the separately requested CURRENT-UI review.
No redesign or new UI implementation has started here. Before pilot use perform
manual mobile/browser validation with Kenneth/Stein: normal path, disconnection,
refresh, exception, undo and cancelled-job recovery. Approve pilot participants,
small order/product set, physical placement/counts, training and stop criteria.
Production schema, deployment and pilot activation each need explicit approval.
