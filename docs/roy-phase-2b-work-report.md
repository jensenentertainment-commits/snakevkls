# Roy Phase 2B — controlled work report

Local implementation, 2026-11-09. Not migrated, deployed or run in production.

## Scope and presentation

The existing `/shopify` page keeps its chat and adds Roy's work report above it
only when `ROY_PHASE2B_ENABLED === "true"`. Default is OFF; no environment file
or production setting was changed. Phase 2A is independent.

The page reads the latest successful report without starting a review. Active
admins can explicitly run a review; active admins/users can read. Warehouse,
inactive and anonymous users cannot read reports or run reviews. The report uses
deterministic Norwegian prose, not a new model request. It states the review
time and oldest/newest content observations and explicitly describes persisted
catalog data, not live Shopify. Re-running does not refresh source data.

The front shows at most five open data-coverage/recommendation items. Optional
information and total lifecycle counts are behind the expandable detail list,
paged at 50 rows with a pinned run ID to reject pagination across new reports.
No full redesign, dismissal workflow, assignment, scheduled worker or Shopify
integration was added. The obsolete Phase 2A help text was corrected.

## Rules, not inferred defects

- Missing canonical observation or incomplete collections: data gap, priority 1.
- Observed empty description or missing featured-image reference: recommendation,
  priority 2. Presence is not quality, and a reference is not a gallery check.
- Empty category/type/vendor: possible improvement, priority 3.
- Missing explicit SEO overrides: information; Shopify defaults can apply.
- Missing/shared SKU: information; both are allowed. Variant-ID remains identity.
- Empty complete collection membership is not a defect. No stale-age threshold,
  duplicate-name verdict, text-quality score or automatic repair is invented.

Field emptiness uses Phase 2A's Unicode whitespace set. Rules operate at product
scope except SKU observations, which use Variant-ID. One product's description
does not produce separate findings for every variant.

## Migration and authorization

`20261109191325_roy_catalog_review.sql` is additive. Existing migrations and
catalog/sync/Viper RPCs remain unchanged. It adds:

- `roy_review_runs`: successful atomic reviews, actor, shop, rule version,
  completion time, population/coverage/finding counts and source time range.
- `roy_review_findings`: stable UUID, unique `(shop, entity_id, rule)`, priority,
  bounded label, state, assessment, first/last-seen times and evaluated run.
- `roy_review_events`: new/resolved/reopened/out-of-scope transitions, keyed by
  run and finding. Reasons and recommendations are deterministic rule-version-1
  presentation text; no product description or credential is copied into findings.

RLS and explicit SELECT-only grants protect all three tables. No browser or
service-role DML grant is added. The public run RPC is SECURITY INVOKER and calls
an explicit active-admin-authorized private SECURITY DEFINER function. The
private function is necessary to persist validated results without permitting
clients to fabricate rows. Its search path is empty, SQL is fixed, and all
objects are schema-qualified. PUBLIC/anon/service-role EXECUTE is revoked;
authenticated execution still requires an active admin at the database level.
Reader RPC is SECURITY INVOKER. The API repeats role checks, validates UUIDs and
origin for POST, and uses the authenticated cookie client, never a service key.

The environment switch controls the application entry points; database grants
remain the underlying authority, not the switch. Production migration/activation
requires separate approval.

## Atomicity, concurrency and lifecycle

One transaction owns a nonblocking Roy advisory lock. The function requires
READ COMMITTED and takes SHARE NOWAIT locks on sync runs, connection identity,
products, canonical content and collections before reading. These conflict with
source writes, including a racing sync claim, without changing existing writers.
Any lock conflict or unfinished run rejects the review. Multiple/no connections
also reject it. A separate, subsequent snapshot reads the locked source.

Locks are short but do temporarily exclude catalog writes. No external API or
AI call occurs while locks are held. The 1,000-synthetic-product test completed
the review in about 190 ms locally; this is not a production latency guarantee.

Findings, events and run summary commit together. Errors roll back everything
and leave the previous report intact. Failed attempts are returned to the caller,
not persisted as partially completed runs. The UI keeps the same request UUID
on an uncertain response; replay returns the completed request without duplicate
events. IDs belonging to another actor are rejected.

Repeated known matches update an existing finding. Known correction resolves;
reappearance reopens the same UUID. Unknown observations retain prior findings
with `assessment=unknown`, never falsely resolving them. Inactive/absent catalog
entities become out-of-scope rather than fixed. There are no cascading foreign
keys to source products that could erase finding history. Run summaries/events
are historical; detailed finding rows represent the latest evaluation, not a
full content snapshot of every historical run.

## Files

- Migration above; `lib/intelligence/roy/review.ts`, `phase2b-gate.ts`.
- `app/api/roy/review/route.ts`, `app/shopify/RoyWorkReport.tsx`.
- Small integration in `app/shopify/page.tsx` and help text in
  `app/shopify/RoyCatalogWorkspace.tsx`.
- `tests/roy-phase2b.test.ts`, `tests/database/roy-phase2b.dynamic.sql`,
  `scripts/roy-phase2b/database-tests.mjs`.

## Validation and reproduction

Run only after explicit local-test authorization:
`node scripts/roy-phase2b/database-tests.mjs --execute-approved`.

The runner is pinned to loopback 55433, PG17.11, user `snake_catalog_test`,
database `snake_phase2a_test_catalogfresh`, system ID `7705827962930311860`,
and `C:/Users/jense/AppData/Local/SnakeCatalogValidation/data`. It uses the
existing SQL identity guard on every session, ignores inherited PG connection
settings, uses only the existing local test passfile and never loads `.env`.
It rejects an existing review schema; migration and fixtures are rolled back.
It never contacts production, snake-test, Shopify or the recovery database.

Verified:

- 516 local tests passed, including six new report/contract tests.
- 23 named SQL assertions plus permission/error exception checks passed:
  stable lifecycle, replay, unknown observations, optional/duplicate SKU,
  active-admin/user/warehouse/inactive access, direct DML denial, injected
  rollback, bounded pagination and stale page rejection.
- Seven two-session checks passed: writer/sync/review exclusion in both
  directions. Postcheck confirmed new schema absent after rollback.
- Existing inventory and product fingerprints unchanged by review; existing
  local target retained. One initial fixture assumption (no existing synthetic
  connection) was corrected to preserve the established `fixture.myshopify.com`.
- TypeScript and changed-file lint passed. Full lint: 0 errors, 28 existing
  warnings. Production build passed after permitting existing font downloads.
- Local interactive browser acceptance passed on 2026-11-09 using
  `scripts/roy-phase2b/browser-preview.mjs --approved`, at localhost:3031.
  Empty state, admin execution, persisted report on navigation, user read-only
  access (direct POST denied with 403), details/pagination, existing/resolved/
  reopened findings and failed-run retention of the previous report/timestamp
  were exercised. Desktop and 390x844 mobile were checked, without horizontal
  overflow. Optional findings remained outside the main priority list.
- Browser acceptance used real local PostgreSQL review/read RPCs in one rolled
  back transaction with synthetic data. Supabase login transport used synthetic
  sessions; the chat model transport was stubbed, while the existing route,
  provider, presenter and database reader ran. This does not constitute a new
  real Supabase login or OpenAI model acceptance test. No production data used.
- Test server stopped; read-only postcheck confirmed system ID
  `7705827962930311860`, review tables absent and the original two products
  retained. The singular wording found during browser acceptance was subsequently fixed
  with a regression test before the approved production release. Seven focused
  tests, TypeScript, lint and diff checks passed.

Local logs: `%TEMP%/roy-phase2b-tests.log`, `roy-phase2b-database.log`,
`roy-phase2b-lint.log`. No commit, push, deploy or production control performed.

## Next approval boundary

Production migration, deploy, Phase 2B enablement and first persisted production
review require separate approval. Proposed order: verify the approved release
and migration hash; apply only `20261109191325_roy_catalog_review.sql`; verify
RPCs, RLS and grants; deploy with Phase 2B disabled; explicitly enable
`ROY_PHASE2B_ENABLED=true` in a new deployment; verify authenticated admin/user
access and approve the first manual production review. On failure disable the
gate through a controlled deployment, retaining report history. Phase 2A stays
available. Cron, Viper and ordinary catalog sync are not part of this change.
No additional backfill or Shopify scopes are required.
