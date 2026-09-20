\ir roy-phase-2a-acceptance.guard.sql
select phase2a_test.check((select r.status='completed' and o.completed_at is not null and o.approved_preview=s.preview
  and s.result=public.get_shopify_sync_run(s.rid)
  from phase2a_test.recovery_state s join private.sync_runs r on r.id=s.rid
  join private.shopify_backfill_operations o on o.operation_id=s.op),'atomic persisted approval and completion');
select phase2a_test.check((select not active and shopify_status='NOT_ACTIVE' from public.products where sku='ACCEPTANCE-UNSEEN'),
  'approved reconciliation committed');
select phase2a_test.check((select count(*)=1 from private.shopify_backfill_pages),'exactly one committed page receipt');
select phase2a_test.check((select pages_processed=1 and processed_count=1 from private.sync_runs),'no duplicated page counters');
-- Lost completion response: a NEW connection retries the identical approval.
select phase2a_test.check(public.complete_shopify_backfill_v1(op,rid,preview,
  'COMPLETE '||op||' '||rid||' '||(preview->>'affectedDigest'))=result,'lost completion acknowledgement idempotent')
from phase2a_test.recovery_state;
