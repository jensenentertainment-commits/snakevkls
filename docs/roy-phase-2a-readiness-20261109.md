# Roy Phase 2A — read-only readiness, 2026-11-09

## Approved evidence substitution

The operator explicitly accepted the documented read-only ordinary-catalog-sync
verification instead of the original protected-backfill proof requirement for
this rollout. This is an acceptance decision, not a claim that a protected
backfill operation or its proof evaluator ran. No new backfill or sync is needed.
Historical proof contracts and migrations remain unchanged.

Fresh authenticated read-only SQL against `gcjvaeqjkrrrzrdccrrv` confirmed:

- 785 active Shopify-linked products / 1,408 variants.
- Canonical content observed for all 785; zero unknown products.
- Complete collection observations for all 785 (783 with membership, two empty).
- Content observations: 2026-11-08 22:46:57.407–22:47:36.828 UTC.
- Missing explicit SEO title: 55; SEO description: 19; product type: 401;
  Shopify category: 280. Description/image reference/name/handle: zero missing.
- 71 active variants without SKU. SKU is optional, not an identity defect.

SQL ran in `BEGIN READ ONLY`, using an existing active admin's subject and
`SET LOCAL ROLE authenticated`, then `ROLLBACK`. This tests database authorization
and reads, not the browser login/session path. No Shopify requests or writes.

## Local corrections

- Exact `Variant-ID 123...` or `gid://shopify/ProductVariant/123...` input uses
  the additive `get_roy_targeted_variant_v1(text)` RPC. No SKU fallback, guessing,
  merging, role changes or response-contract expansion. Conflicting/malformed
  references ask for clarification. Follow-up ID inference is not added.
- The reader is STABLE / SECURITY INVOKER with the existing active admin/user
  check, RLS and response bounds. Anonymous/service-role execution is denied.
- Multi-topic targeted questions now include description, image and both SEO
  fields rather than silently answering only the first matched topic.
- Missing-SKU questions show the existing bounded finding evidence and clearly
  state that SKU is optional. Examples are product-name evidence, not a complete
  or unambiguous variant-ID list; repeated names can represent different variants.
- Ambiguous SKU responses now request exact Variant-ID rather than another SKU.

Migration: `20261109182708_roy_exact_variant_reader.sql`.
SHA-256: `ded4711813514421d13528e8d462a79fcba070c4c9ffbe5bb26e679ff1e0631d`.
Depends on the existing Phase 2A targeted reader's helper, tables and RLS.
No historical migration changes. Not applied to production or snake-test.

## Eight request-pipeline/model tests

The actual provider, route resolver, workforce authorization/execution, system
prompt, model-input builder and response presenter ran locally. Only the
Supabase transport was substituted with freshly captured authenticated read-only
query results. The real `gpt-5-mini` API was used with `store:false`, after the
operator explicitly approved the bounded catalog-field transfer. Credentials
were process-local, never printed. No production telemetry inserts were made.

| Question | Verified result |
| --- | --- |
| Hvor mange aktive produkter og varianter finnes i katalogen? | 785 / 1,408 |
| Hvor mange produkter mangler bildereferanse? | 0 observed missing; image quality not inferred |
| Hvor mange produkter mangler beskrivelse? | 0 observed missing |
| Hvilke produkter mangler eksplisitt SEO-tittel? | 55; bounded examples; Shopify fallback caveat |
| Har SKU ALB-ULL-001 beskrivelse, bilde og SEO-felt? | Description/image present; both SEO overrides empty |
| Hvilke collections tilhører SKU P-WIPES-DRY-BAM-REF-1520-80? | Under 100,-; Renhold & Hygiene |
| Hvilke varianter mangler SKU? | 71; bounded product-name evidence after correction and targeted retest |
| Vis produktinnholdet for SKU 739007 | Ambiguous; no arbitrary product selected; asks for Variant-ID |

Eight model requests completed; question 7 was rerun once after its concrete
presentation correction. Eight final response assertions passed. This is not
a live HTTP/browser/session end-to-end test and does not establish production
activation. The new Variant-ID path was tested separately with synthetic SQL
and local routing tests, not by installing its RPC in production.

## Local validation

- 510 tracked `.test.ts/.test.mjs/.test.js` tests passed, zero failures.
- 35 focused Phase 2A tests included in that total.
- TypeScript passed. Full lint: zero errors, 28 existing warnings;
  changed-file lint passed without warnings.
- Production build passed after allowing its existing Google Fonts downloads.
- New SQL fixture passed in `snake_phase2a_test_catalogfresh`, loopback 55433,
  system ID `7705827962930311860`, user `snake_catalog_test`, approved data path.
  It covered SKU-null/duplicate/exact/not-found/inactive behavior, invalid ID,
  invoker/grants, admin/user/warehouse/inactive-user authorization.
  Migration and all synthetic rows rolled back. Postcheck: original two products
  and four profiles retained; synthetic user absent; new RPC absent.
- Original unqualified `npm test` auto-discovered an interactive Shopify script
  and waited for stdin. It received no credentials/configuration and made no API
  request. The verified test processes were stopped and the explicit tracked
  test-file list completed. No Viper tooling was changed.

Local evidence (outside Git):
`C:\Users\jense\AppData\Local\Temp\roy-read-smoke-final-20261109.json`,
`roy-read-smoke-result-20261109.json`,
`roy-read-smoke-result-20261109-retest7.json`,
`roy-local-tests-20261109.log` in the same directory.
The read-only input snapshot is `roy-read-smoke-20261109.json` there.

## Remaining approval boundary

Roy's production gate/configuration was not changed. No commit, push, deploy,
production migration, Shopify mutation, inventory or Viper change was performed.
Before limited user testing: review this local change, separately approve the
additive migration/deploy and controlled Phase 2A activation, then verify actual
authenticated browser chat (including a SKU-less Variant-ID). Production gate
continuity must be checked at that window; this task did not reconfigure it.

## Next proposal — not implemented

Build a small rule-based catalog review over the existing persisted catalog:
missing description/image reference, explicit SEO overrides, product type and
category, with clear distinction between unknown, empty and quality judgments.
SKU absence remains informational. Persist stable finding identities, first/last
observed times and new/open/resolved state; repeat checks update rather than
duplicate findings. Assign transparent rule-based priority and short recommendations.
Show the latest completed review and its timestamp when opening Roy, with chat
alongside. Schedule checks only after separate approval, avoid partial-sync
snapshots, and do not write to Shopify. Text-quality AI assessment comes later.
First deliverable should be a small rule/severity/state design for approval,
not a new implementation round in this task.
