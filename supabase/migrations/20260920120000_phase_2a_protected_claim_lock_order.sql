-- Forward correction only: acquire the bound operation before the run row.
-- The global admission lock still serializes fresh admission and completion.
create or replace function public.claim_shopify_backfill_v1(requested_operation uuid, requested_run_id uuid, confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claim jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('snake_shopify_sync', 0));
  if confirmation is distinct from ('RESUME ' || requested_operation || ' ' || requested_run_id) then
    raise exception 'Operation/run approval mismatch';
  end if;
  perform 1 from private.shopify_backfill_operations
    where operation_id=requested_operation and run_id=requested_run_id for update;
  if not found then raise exception 'Operation/run approval mismatch'; end if;
  if exists(select 1 from private.sync_runs where id=requested_run_id and (status='completed' or has_next_page=false)) then
    return public.get_shopify_sync_run(requested_run_id) || jsonb_build_object('acquired',false,'completionHold',true);
  end if;
  claim := private.claim_shopify_sync_run('manual',null,90);
  if claim ->> 'runId' is distinct from requested_run_id::text then raise exception 'Bound run mismatch'; end if;
  if claim ->> 'acquired' = 'true' then
    update private.shopify_backfill_operations set claim_count=claim_count+1 where operation_id=requested_operation;
  end if;
  return claim;
end; $$;
revoke all on function public.claim_shopify_backfill_v1(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_shopify_backfill_v1(uuid,uuid,text) to service_role;
