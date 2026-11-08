# Release candidate — 2026-11-08

Base: master / c883708263e78698cd02a6c49fccfa64bce9ddfc. Uncommitted candidate; no deployment authorization. Paths below are exact additions/changes relative to base; unchanged application dependencies remain part of the base.

## Artifact boundary

Production application consists of the Production application list plus the unchanged base. Apply only the 12 explicit migrations below through a separately approved database window; never execute tests/database or scripts/viper seed files in production. Tests/docs/operator tooling may be versioned for traceability but are not application startup, routes, or automatic deployment actions. No npm build/start or Vercel change invokes them. Generated preview/E2E copies, local database directories, credentials, .env files, dumps and node_modules/.next are excluded from versioned delivery. Deploy from the repository, never from SnakeViperPreview/SnakeViperE2E workspaces. No application import of those harnesses was found.

Catalog: lib/shopify persistence/proof, Roy ambiguity compatibility, migration 11. Viper: app/lib/viper plus shared navigation/shell, migrations 8–10 and 12. Roy remains gated OFF; compatibility changes are not activation.

## Ordered pending production migrations

All 34 local migration hashes match fresh evidence; these 12 pending files also match upgrade evidence. Preserve this tested order, with ordinary workers and Viper mutations closed until matching application deployment is verified.

| Order | File | SHA-256 |
|---:|---|---|
| 1 | 20260907195256_phase_2a_product_content_foundation.sql | 57b9955dae55405834b9528e22c97c4c026fab44cc1ad559d4ce0cf2a59f7975 |
| 2 | 20260917192405_phase_2a_transactional_sync_persistence.sql | 55fa6ffcdb56a3e92a91d9ed0dc2df3b43c674d6358bfa24b7cfeea730a87d57 |
| 3 | 20260917200011_phase_2a_catalog_foundation_rpc.sql | 22034a435f64318b2f0e2f3ca8084c6d609e555c5d8cf64c3ea772d48c67ee2f |
| 4 | 20260919090000_phase_2a_roy_targeted_reader.sql | e227412ac2c810e17b3f33e45cb2276390cdedbd4453af62bf2e288fbd56edce |
| 5 | 20260919093000_phase_2a_protected_backfill.sql | c67c564ced5e0f78ad287163ccab6ca6b6dea51b413484d40cd3f539ff6aaa72 |
| 6 | 20260919094000_phase_2a_backfill_proof.sql | 07c8b3041c70c30b448e87fb03c034b8810a6c0f6bfa83363921da4c258dd84b |
| 7 | 20260920120000_phase_2a_protected_claim_lock_order.sql | 14d5d8ed14a13179b4c75c7316a094329efb2e3d477422c7b2c87fd9e75f0ce5 |
| 8 | 20261103215816_viper_shared_location_validation.sql | 0d457477a7aae83c0a8a9829c0e11fc246110a4ec6ee5fc6851dddce980a9e13 |
| 9 | 20261104062000_viper_fenced_pick_commands.sql | b140065898be473370ec85fb97220846db055782510427c12be008f03008998e |
| 10 | 20261104201000_viper_fresh_start_completion.sql | b3b08a0d15273b38ddb7d8a360f67f5a3aa0aea7bc403bfe1a61f308834e4eac |
| 11 | 20261108170000_sku_independent_catalog_identity.sql | 26c1bb3da2835fb631b8873fd51ca35a87649020a6bea9bd8c8b88d809098898 |
| 12 | 20261108170100_viper_optional_sku_compatibility.sql | 91129ab60fa469ee46c779b63a83b6cb200322be974f4d836d2171fa7c1bf2b5 |

Migrations 1–7 are unchanged Phase 2A foundation. 8–10 are Viper; 11 is SKU identity/protected reconciliation; 12 removes cross-catalog SKU equality from Viper. The old app must not pick between the Viper schema changes and matching deployment. No worker may run an obsolete fallback writer.

## Production application (41)

- `app/api/viper/admin/exceptions/[id]/resolve/route.ts`
- `app/api/viper/admin/picks/[id]/reprepare/route.ts`
- `app/api/viper/pick-lines/[id]/confirm/route.ts`
- `app/api/viper/pick-lines/[id]/exceptions/route.ts`
- `app/api/viper/pick-lines/[id]/undo/route.ts`
- `app/api/viper/picks/[id]/cancel/route.ts`
- `app/api/viper/picks/[id]/complete/route.ts`
- `app/api/viper/picks/[id]/start/route.ts`
- `app/components/navigation/index.ts`
- `app/components/navigation/modules.ts`
- `app/components/navigation/types.ts`
- `app/components/shell/AuthenticatedAppShell.tsx`
- `app/components/shell/route-config.ts`
- `app/components/viper/PickCorrection.tsx`
- `app/components/viper/ResolveViperException.tsx`
- `app/components/viper/ShopifyOrderPreviewForm.tsx`
- `app/components/viper/StartPickButton.tsx`
- `app/components/viper/ViperPickFlow.tsx`
- `app/components/viper/useViperCommand.ts`
- `app/viper/admin/exceptions/page.tsx`
- `app/viper/admin/order-intake/page.tsx`
- `app/viper/admin/recovery/page.tsx`
- `app/viper/orders/[id]/page.tsx`
- `app/viper/page.tsx`
- `app/viper/picks/[id]/page.tsx`
- `lib/intelligence/roy/catalog-semantics.ts`
- `lib/intelligence/workforce/contexts/shopify-catalog-provider.ts`
- `lib/shopify/backfill-proof.ts`
- `lib/shopify/sync-persistence.ts`
- `lib/viper/orders/dto.ts`
- `lib/viper/orders/repository.ts`
- `lib/viper/picks/command-handler.ts`
- `lib/viper/picks/command-validation.ts`
- `lib/viper/picks/dto.ts`
- `lib/viper/picks/repository.ts`
- `lib/viper/picks/source-check.ts`
- `lib/viper/shopify/order-client.ts`
- `lib/viper/shopify/order-materialization.ts`
- `lib/viper/shopify/order-preview.ts`
- `lib/viper/shopify/order-source.ts`
- `lib/viper/shopify/preview-types.ts`

## Documentation and read-only evidence (8)

- `docs/catalog-local-database-environment.md`
- `docs/catalog-preflight-2026-11-08.json`
- `docs/catalog-sku-independent-identity.md`
- `docs/release-manifest-2026-11-08.md`
- `docs/viper-e2e-1001.md`
- `docs/viper-local-preview.md`
- `docs/viper-v1-local-progress.md`
- `docs/viper-v1-operations.md`

## Tests (41)

- `lib/shopify/backfill-proof.test.ts`
- `lib/shopify/sync-persistence.test.ts`
- `lib/shopify/sync-recovery.test.ts`
- `tests/catalog-identity.integration.test.mjs`
- `tests/database/catalog-concurrency-cleanup.sql`
- `tests/database/catalog-concurrency-completion.sql`
- `tests/database/catalog-concurrency-setup.sql`
- `tests/database/catalog-concurrency-writer.sql`
- `tests/database/catalog-identity.dynamic.sql`
- `tests/database/catalog-viper-sales.dynamic.sql`
- `tests/database/roy-phase-2a-acceptance.guard.sql`
- `tests/database/roy-phase-2a-backfill.dynamic.sql`
- `tests/database/roy-phase-2a-sync-persistence.dynamic.sql`
- `tests/database/roy-phase-2a-upgrade-assertions.sql`
- `tests/database/roy-phase-2a-upgrade-seed.sql`
- `tests/database/viper-acceptance.guard.sql`
- `tests/database/viper-historical-baseline.sql`
- `tests/database/viper-v1-location-validation.dynamic.sql`
- `tests/database/viper-v2-commands.dynamic.sql`
- `tests/database/viper-v2.cleanup.sql`
- `tests/database/viper-v2.seed.sql`
- `tests/database/viper-v3-source-stock.dynamic.sql`
- `tests/database/viper-v4-acceptance.dynamic.sql`
- `tests/design-system-lager-pilot.integration.test.ts`
- `tests/digital-workforce-roy-product-variant-semantics.test.ts`
- `tests/roy-phase-2a-forward-fix.test.mjs`
- `tests/ui-refresh-shell.integration.test.ts`
- `tests/viper-database-runner.test.mjs`
- `tests/viper-e2e-preparation.test.mjs`
- `tests/viper-e2e-resume.test.mjs`
- `tests/viper-p2.integration.test.ts`
- `tests/viper-p3.integration.test.ts`
- `tests/viper-p4-materialization.integration.test.ts`
- `tests/viper-p4-preview.integration.test.ts`
- `tests/viper-preview.test.mjs`
- `tests/viper-shell.test.ts`
- `tests/viper-shopify-read-test.test.mjs`
- `tests/viper-ui-design.test.ts`
- `tests/viper-v1-source.test.ts`
- `tests/viper-v2-commands.test.ts`
- `tests/viper-v3-source.test.ts`

## Local/operator tools (not application runtime) (18)

- `scripts/roy-phase2a/database-acceptance.mjs`
- `scripts/roy-phase2a/local-catalog-acceptance.ps1`
- `scripts/viper/database-acceptance.mjs`
- `scripts/viper/e2e-manifest.mjs`
- `scripts/viper/e2e-seed-plan.mjs`
- `scripts/viper/e2e.mjs`
- `scripts/viper/e2e.ps1`
- `scripts/viper/preview-seed.sql`
- `scripts/viper/preview.mjs`
- `scripts/viper/preview.ps1`
- `scripts/viper/set-test-password.ps1`
- `scripts/viper/shopify-read-test.mjs`
- `scripts/viper/shopify-read-test.ps1`
- `scripts/viper/step2-acceptance.mjs`
- `scripts/viper/step2-concurrency.mjs`
- `scripts/viper/step3-acceptance.mjs`
- `scripts/viper/step3-concurrency.mjs`
- `scripts/viper/step4-acceptance.mjs`

## Database migrations (5)

- `supabase/migrations/20261103215816_viper_shared_location_validation.sql`
- `supabase/migrations/20261104062000_viper_fenced_pick_commands.sql`
- `supabase/migrations/20261104201000_viper_fresh_start_completion.sql`
- `supabase/migrations/20261108170000_sku_independent_catalog_identity.sql`
- `supabase/migrations/20261108170100_viper_optional_sku_compatibility.sql`

## Production readiness

Read-only source comparison: catalog-preflight-2026-11-08.json (no secrets/customer/order data). Current comparison is a sequential observation, not an atomic cross-system snapshot; rerun before recovery approval. The 193 candidates include one physical-stock blocker, SKU 63104. Do not recover the ordinary run until its treatment and the complete candidate list are approved.

The production backup/isolated restore rehearsal is complete and approved with the explicit exceptions below. This does not authorize rollout. A fresh pre-change backup, ledger-only reconciliation, quiescence, schema/deploy, failed-run recovery, routine scheduler restoration and Viper pilot remain separately approved steps.

## Final validation and live preflight

2026-11-08: 499/499 local tests; TypeScript noEmit passed; lint 0 errors/29 existing warnings; production Next.js build passed (27 static pages). Initial sandbox build could not download Google Fonts; the same build passed with network permission, without code/config changes. Full local database fresh and upgrade acceptance both PASS. No deployment performed.

Live production deployment: dpl_BuzT6mxdbEot7vcdim14j9WAeHZp, commit c883708263e78698cd02a6c49fccfa64bce9ddfc. Project snakevkls-yh9b. Current Production environment listing has no ROY_PHASE2A_ENABLED (hiddenProductionEnvCount=0); VIPER_SHOPIFY_IMPORT_ENABLED exists as sensitive, its value unavailable. This listing is not proof of the active deployment's captured environment. Roy's previously operator-confirmed OFF state is consistent with the listing, but effective deployment continuity and Viper gate need operator verification. No variables were changed.

Cron definition remains /api/cron/shopify-sync at 0 2 * * * in vercel.json. Live enable/disable status is unverified. The active firewall lookup returned 404 and bypass lookup 402 (plan limitation); neither proves the absence of rules/bypasses. Operator must capture actual project-wide controls and deployment-host coverage before any window. No upgrade or control change is requested by these tool limitations.

Live database run b55dd998-ae63-40b8-8bc3-9985d4065b65 remains failed, cursor NULL, pages 0, hasNextPage true, lease NULL. Open orders/picks/exceptions and pending/processing/failed Lagersalg jobs all zero at observation time. No run was resumed.

Full Shopify active-variant traversal completed in six pages: 1408 variants / 785 products; 71 missing SKU; four duplicated SKU groups (739007, 739008, 739012, VK-TIGHTS-SCRUNCH-GRBL-HW-1; two variants each). 1292 variants already match Snake, 116 would be new (71 without SKU). Snake has 1990 products / 1443 active. 193 active linked rows are absent from the observed active source; 192 have no observed active dependencies, one blocks reconciliation. Exact candidate/new-variant/conflict lists are in catalog-preflight-2026-11-08.json.

Only risky deactivation: f313e906-be1a-4eef-8b03-dad3758a5904 / SKU 63104 / Variant 49709379649842 / 4 units at HL01-01-01-A1. Specific Shopify variant lookup returned null and unrestricted-status SKU search returned no variants. Do not infer deletion reason, replacement identity or physical disposition. An operator must resolve the real-world identity/disposition before ordinary completion; do not transfer stock, relink or deactivate automatically. The entire final reconciliation will correctly fail until active dependencies are resolved through separately approved operations.

SKU 1513-11 now belongs to source variant 67982076969266 while Snake's existing row points to 51384632738098; create a distinct new UUID for the new variant, preserve the old UUID/references. Duplicate source SKUs similarly never merge. Observation is not an atomic cross-system snapshot and must be refreshed before recovery approval.

## Historical ledger mapping (do not replay SQL)

| Repository timestamp | Production timestamp | Name |
|---|---|---|
|20260819182058|20260822223137|future_foundation_physical_pick_order|
|20260819183002|20260822223152|viper_physical_pick_order|
|20260819192637|20260819195743|role_model_expand|
|20260819200716|20260819202248|role_model_contract|
|20260822223701|20260822224135|location_purpose_viper_fallback_and_locations_import|

The prior read-only review confirmed normalized-body fingerprints for all five. Preserve original production ledger statements and review exact equivalence before separately approved ledger-only reconciliation. Never replay historical location creation. Post-reconciliation plan must contain only the 12 pending migrations listed above.

## Next approval boundary

Approve the exact staged release candidate for a local commit first; push and deployment are separate decisions. Before production changes, refresh effective gates and worker/control evidence and approve quiescence plus a fresh pre-change backup. The recovery rehearsal below is already complete. Product 63104 remains a blocker for ordinary sync completion, not a requirement to rewrite its identity or stock during schema preparation. Ledger/schema changes, matching application deployment, ordinary run recovery, restoration of routine workers and the limited Viper pilot remain separate approvals. Roy activation and protected population remain paused.

## Final release preparation after approved recovery rehearsal

Candidate label: `snake-catalog-viper-20261108-rc1`. Base commit remains `c883708263e78698cd02a6c49fccfa64bce9ddfc`. The exact candidate is the Git index tree reported with this preparation; no commit, push or deployment has been performed. The 113 explicitly listed changed/new files comprise 41 production application files, 5 new migration files, 41 test files, 18 operator tools and 8 documentation/evidence files. Seven pending Phase 2A migrations are already in the unchanged base. Tests and operator tools are source-controlled supporting material, not runtime entry points or automatic migration hooks.

Rechecked all 12 pending migration SHA-256 values against both retained PASS manifests: `acceptance-full-fresh-20261108/result.txt` and `acceptance-resumed-20261108-1807/upgrade/result.txt` beneath the local SnakeCatalogValidation workspace. Both manifests contain 34 migrations; all 12 pending hashes match. No database acceptance was rerun during release preparation.

Hash scope clarification: the ordered table records exact Windows working-file bytes used by database acceptance. Ten pending files also match the staged Git bytes exactly. Two historical files have CRLF in the tested working copy and LF in Git; comparison confirms that replacing CRLF with LF is the only difference. Their staged blobs are unchanged from HEAD; no historical migration was edited. Git/LF SHA-256 values are:

| File | Git/LF SHA-256 |
|---|---|
| 20260907195256_phase_2a_product_content_foundation.sql | 82a8f4939992c85cd81a4bebb85183694c9f971b7ec1722fea17806b9414bd7f |
| 20260917192405_phase_2a_transactional_sync_persistence.sql | 86a1d512d45b0c230b9b6d26e17607276c49b091d2a288962fe359e11980cc51 |

Before production migration approval, explicitly select the execution artifact: the retained working files match the acceptance hashes byte-for-byte; a Git checkout must be verified against the Git/LF hashes above plus the other ten table hashes. Do not report all Git migration blobs as byte-identical to acceptance or silently rewrite the historic migration files. The line-ending-only equivalence is established; acceptance did not execute the two LF byte streams separately.

Final local checks: 499/499 tests across all 78 `*.test.ts`/`*.test.mjs`/`*.test.js` files under `lib` and `tests`; TypeScript `--noEmit` PASS; lint PASS with 0 errors and 29 existing warnings; production build PASS. The first sandbox build failed only on Google Fonts downloads and passed with network access, without code/configuration changes. Plain `npm test` also discovers the interactive operator tool `scripts/viper/shopify-read-test.mjs` and waits for stdin; that child was stopped and the full explicit test-file suite passed. No credentials were supplied and no Shopify API test ran. This test-discovery limitation is documented, not changed in this release-preparation task.

### Recovery evidence and limits

One production custom-format backup was taken over verified direct TLS 1.3 from PostgreSQL 17.6 using 17.11 tools. Full restore completed atomically with exit code 0 and no warnings in the isolated local `snake_production_restore_rehearsal` database. All 62 table datasets matched the archive by row count and SHA-256; migration ledger contained 22 matching records. Public-schema checks recorded 40 validated foreign keys, 20 RLS-enabled tables and 28 policies.

Selective recovery also PASS: five `public.zones` rows were selected from the original archive and loaded into a temporary database table with `LIKE INCLUDING ALL`, after emptying the temporary dataset. All fields/UUIDs matched the archive by SHA-256. The transaction was rolled back and all 62 persistent datasets rechecked unchanged. This was actual temporary-table data restoration, not only archive extraction; it did not test replacing a live production table.

Approved exceptions: eight entries for the unused, empty Vault extension/configuration were omitted from the restore list; 52 platform/extension ownership differences are expected local-role differences with no identified Snake grant/RLS regression; nine default-ACL differences are statement ordering only. This establishes Snake logical schema/data recovery, not full Supabase service parity, PITR, Storage-file recovery or production authorization.

Original dump SHA-256: `3BF189901A81A9B3B331620BB7F68B6106FA2726663536662B94B1BA296F733E` (1,609,783 bytes). AES-256/header-encrypted archive SHA-256: `9FC40E342A57B1A23B3FE248205FA1172CE96A78CD050B48EB720E888D915244` (938,338 bytes), identical on primary storage and USB. Interactive decryption/integrity testing was operator-confirmed; the negative header-password probe rejected access. Restricted evidence is retained outside Git under `SnakeProductionRecovery`, including `recovery-final-result.json` and `selective-recovery-result.json`. No dump, schema/data extraction, credential or recovery helper is part of this release.

### Explicit exclusions and current operational evidence

Keep `certs/prod-ca-2021 (1).crt` untracked and out of staging/deployment; it is a public local CA file, not an application dependency. Exclude all `.env*`, DPAPI credentials, database directories, recovery files, dumps, encrypted archives, generated SnakeViperPreview/SnakeViperE2E workspaces, build output and local logs. Deploy only the approved Git artifact, not an arbitrary working-directory upload. Do not include these external files in build context.

Subsequent operator evidence supersedes the earlier unknown-control snapshot: Vercel Cron is active with a Disable Cron Jobs control; Firewall supports Request Path / Starts with / Deny; Supabase Enable Data API is active and accessible. None was changed during recovery or release preparation. These observations do not establish current rule precedence/bypass coverage or effective deployment gate values; verify those at the change window. Vercel-only blocking is insufficient because browser code writes directly to Supabase. Administrative PostgreSQL access independent of Data API has been verified. No automatic reopening is authorized.
