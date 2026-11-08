# Viper #1001: preparation only

Prepared 2026-11-07. No seed, integration startup or Shopify request executed by this preparation task. No production access. Existing UI preview and application sources are unchanged.

## Exact manifest

Machine-readable authority: `scripts/viper/e2e-manifest.mjs`.

| Sequence/location | Shopify variant GID suffix | SKU | Initial → completed |
|---|---|---|---|
| 1 / VE2E01 | 48590430667004 | WINTER-M | 10 → 9 |
| 2 / VE2E02 | 48590431944956 | NULL | 10 → 9 |
| 3 / VE2E03 | 48590427455740 | ESP-6CUP | 10 → 9 |
| 4 / VE2E04 | 48590426013948 | BEANIE-BLK | 10 → 9 |
| 5 / VE2E05 | 48590426046716 | NULL | 10 → 9 |

Variant prefix: `gid://shopify/ProductVariant/`. Each quantity to pick is 1.
Zone UUID `a2000000-0000-4000-8000-000000000001`, code VE2E, name “Viper E2E testlager – ordre #1001”, active=true, pick_priority=201.
For row N (1–5), UUIDs use 12-digit zero-padded N:

- Product `a4000000-0000-4000-8000-N`, synthetic name `Viper E2E #1001 – testvare N`, active=true, variant_name=NULL, exact variant ID/SKU above. shopify_product_id=NULL (not required by Viper), shopify_quantity=NULL (not a Shopify inventory observation).
- Location `a3000000-0000-4000-8000-N`, zone UUID above, active=true, purpose=PICK, pick_sequence=N.
- Inventory `a5000000-0000-4000-8000-N`, product/location/zone foreign keys above, quantity=10, is_primary=true.
- Timestamps use database defaults. Other optional product metadata remains NULL/default; no fabricated canonical observations. Local product display names are intentionally synthetic; imported order names come from Shopify.

Read-only schema inspection confirmed nullable SKU, required product_name, zone priority, positive priorities/sequences, PICK/BUFFER constraint, nonnegative quantity and foreign keys. Variant IDs, non-NULL SKUs, zone code/priority and location codes are unique. No current collisions for the proposed variant/SKU/code/priority values. This is not a reservation: repeat checks including UUIDs immediately before seed.

## Separate launch and isolation

`scripts/viper/e2e.ps1 -Verify` authenticates read-only and checks pinned HTTPS project, both Supabase keys, Viper version column, zero Shopify connections, live Shopify domain/ID, Viper Read Test app identity and exact read_orders/read_products scopes, then exact order/line manifest. No database write. Not run yet.

`scripts/viper/e2e.ps1 -StartApproved` repeats verification, requires the exact seeded rows, one active test admin, no prior import of this order and no in-progress job, then starts a fresh copy on 127.0.0.1:3000. No automatic seed/reset. Do not run until execution approval.

- Shopify `jensendigita.myshopify.com`, shop `76635341052`, order `18982115672316` / #1001 only. Supabase `mvwpbscexvnfavxhbexb` only. Direct SQL preflight must additionally confirm system ID `7702071863184491885` with existing verified TLS/test credentials; API startup verifies project host/keys, not PostgreSQL system ID.
- Credentials read from existing Windows-DPAPI files and transferred via stdin, never arguments/logs/files. Parent environment is allowlisted; no .env files, production integration variables, proxy/TLS overrides or NODE_OPTIONS inherited.
- Only a disposable source copy is adapted: the existing Shopify query/error handling remains intact; its database token lookup is replaced with an ephemeral server-only read token. Token is not stored in Supabase or browser. Roy stays off. Lifetime is bounded by token expiry or two hours; stopping requires fresh verification before restart.
- Local proxy permits only #1001 preview/import and commands belonging to its Shopify job. Other jobs' commands, other APIs, cron, sync, connections, admin recovery/resolution, server actions and non-loopback origins are denied. Existing route role checks and SQL fencing remain authoritative. Cancellation/undo/report are available only for this job; broader recovery requires a separately reviewed procedure.
- Current UI preview files/guards remain untouched. It will still reject persisted Shopify connections. Only one localhost:3000 process may run; never kill an unverified process to free it.
- Scope limitation: this tests real Shopify reads plus existing Viper materialization/picking, **not** persistent Shopify connection storage/OAuth installation. No connection row needs cleanup. Proxy guards are test-session accident prevention, not isolation from a malicious administrator who already owns test database credentials.
- `test=false` is explicitly accepted only for this exact order in this development shop. No test payment, fulfillment or inventory mutation is performed in Shopify.

## Approved-next execution sequence (not executed)

1. Obtain separate execution/seed approval. Stop any existing preview deliberately. No parallel acceptance runner, catalog worker or other test session. Confirm PostgreSQL test system ID over verified TLS; use no production configuration. Capture schema/migration state, relevant counts, exact existing products/inventory/jobs and event IDs in restricted local evidence. Exclude auth tokens/customer fields.
2. Run `e2e.ps1 -Verify`. Capture only safe order ID/status/updatedAt, five line IDs/variant IDs/SKUs/quantities. Recheck test=false, PAID/UNFULFILLED, not cancelled/closed and source eligibility. Any drift stops. No automatic edits to Shopify or manifest.
3. Generate review SQL with `node scripts/viper/e2e-seed-plan.mjs --print-review-sql`. It performs no network I/O. Review guards and insert exactly 16 rows (zone + five products + five locations + five inventories). Under approval, set the explicit local approval inside BEGIN and replace the final review-default ROLLBACK with COMMIT only after checking all fields/joins, 10 each, total50 and unchanged existing rows. SQL uses table locks, fail-closed collision checks, no upsert; an error rolls back all inserts. No order/job is seeded directly.
4. Start `e2e.ps1 -StartApproved`; log in using existing `viper-ui@example.test` credentials. Confirm test banner and network host snake-test. Verify forbidden IDs/paths produce403 and no writes; confirm original auth/role checks still apply. This runtime/browser check remains outstanding.
5. In Shopify order intake enter numeric ID18982115672316. Preview must show five importable physical lines, one each, correct VE2E01–05, no SKU errors. Compare actual SQL resolver result to manifest. Stop if different; do not force import.
6. Import once. Record generated order/job/line IDs and version/command correlation IDs without customer data. Confirm inventory remains50. Start performs fresh Shopify and database checks. Confirm five lines in sequence; stock must still be10 each before completion.
7. Complete once using normal Viper button. Verify job completed, order picked, five picked lines, 9 each/45 total; exactly one set of stock deductions, expected import/start/line/completion events and actor/correlation references. Repeat completed command with the SAME command ID only as an explicitly controlled idempotency check: no second deduction. Do not manufacture a new command or reset versions.
8. Read Shopify order again: ID, updatedAt, status, quantities, cancellation/closure unchanged. read-only scopes and absence of mutation requests establish that this harness cannot alter Shopify stock/fulfillment. These scopes do not give independent location-level inventory evidence; do not claim that was measured. Any external change invalidates the no-change comparison and requires investigation.
9. Compare all pre-existing test rows against baseline (inventory quantities and IDs, existing orders/jobs/locations/products). Retain non-sensitive evidence. Stop server and verify port closed. Do not automatically cancel/delete/reset anything. No production deployment follows.

## Failure/recovery and cleanup

- Before seed commit: ROLLBACK; no partial fixture. Do not retry collision errors with upsert.
- Before import: stop server; seed may be retained. Under separate cleanup approval, require exact unchanged fixture and no referencing orders/picks/events; delete only five inventory UUIDs, five product UUIDs, five location UUIDs, then zone UUID, in one guarded transaction. Verify foreign-key references first; no cascade shortcut or broad VE2E-prefix delete.
- After import/start: stop on first material discrepancy. Preserve job/order/version/command IDs, events and quantities. Never rerun seed or reset a job in SQL. If server remains live, use existing cancellation/undo with reason and physical-return confirmation where relevant. Cancellation must leave inventory unchanged. If unavailable/expired, read-only diagnose and prepare explicit recovery; startup deliberately refuses prior imports to avoid silently restarting a partial test.
- Ambiguous completion: query authoritative job, command-result and inventory/event state before acting. If completed with quantity9, retain result; do not complete again with a new command. If transaction rolled back, stock stays10; recover via existing command semantics after review. Do not manually increase quantities to hide a failed assertion.
- After completed test: recommended cleanup is stop server and retain fixture/history as evidence. Original UI preview can start again because no Shopify connection was persisted. Its queue will include the additional test job. Optional archival/deletion of only test-owned rows needs a separate dependency manifest and approval; never delete audit history or existing VUI rows as part of automatic cleanup.
- Disposable workspace contains copied source/build output only; no token files. Remove only the identified workspace after process exit and evidence retention; no recursive shared-directory cleanup. Existing DPAPI credentials stay unchanged.

## Outstanding gates

### Controlled resume (approved 2026-11-08)

Use `scripts/viper/e2e.ps1 -ResumeApproved` only for existing job
`3974c454-a1cc-47ca-ad57-94d3ef1f7f10`, order
`0d3c414c-b7c3-478d-98ac-77bcad9f5558` / Shopify #1001.
This is a separate mode; `-StartApproved` keeps its first-import rejection unchanged.
Resume requires exactly one matching order/job, in_progress/version6, no completion,
five manifest-matched picked lines (one each), correct order-line/inventory relations,
the same active test administrator assignment, no other active job and stock10 each.
Fresh Shopify identity/scopes/eligibility and updatedAt matching the imported source
are mandatory. Existing project/key, zero-connection, DPAPI, sanitized environment,
loopback, two-hour/token expiry, role checks and proxy route guards remain unchanged.
All startup reads are GET; no seed/import/reset/recovery RPC is called.
Stop on any mismatch. It is intentionally not a general resume facility.
After startup perform read-only status verification. Full completion requires its
own approval and is not performed by this mode. Do not use this mode after version6.

Preparation tests are offline/mocked; no live launcher, SQL seed, browser run or real E2E executed. Before approval, review manifest and token-adapter test boundary. Separate approval required for test seed/commit, integration startup/import/pick, any recovery/deletion. No changes to vk-lager, Shopify data, .env.local, existing UI preview, commit, push or deployment.

Local preparation validation: 19 focused tests passed; explicit test files under `tests/` passed; TypeScript `--noEmit --incremental false`, focused ESLint, PowerShell parser and diff/new-file whitespace checks passed. Broad `npm test` discovery stalled after partial output and was interrupted; it is not counted as a passing run. No production build or live generated-workspace/browser validation was performed in this preparation task.
