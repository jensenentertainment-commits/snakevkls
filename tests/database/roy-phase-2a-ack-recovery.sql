\ir roy-phase-2a-acceptance.guard.sql
do $$ declare s phase2a_test.recovery_state%rowtype; r jsonb; before_state jsonb; begin
  select * into s from phase2a_test.recovery_state;
  r:=public.recover_shopify_backfill_v1(s.op,s.rid,'RESUME '||s.op||' '||s.rid);
  perform phase2a_test.check(r->>'pagesProcessed'='1' and r->>'hasNextPage'='false' and r->>'cursor'='final',
    'lost committed acknowledgement recovered from database');
  before_state:=phase2a_test.control_snapshot();
  perform phase2a_test.reject_command(format('select public.apply_shopify_backfill_page_v1(%L,%L,%L,null,0,%L,false,%L,%L,%L)',
    s.op,s.rid,s.claim->>'leaseToken','final','[]','[]','[]'),'checkpoint conflict');
  perform phase2a_test.check(phase2a_test.control_snapshot()=before_state,'retry cannot duplicate receipts/counters');
  perform phase2a_test.check(public.claim_shopify_backfill_v1(s.op,s.rid,'RESUME '||s.op||' '||s.rid)->>'completionHold'='true',
    'persisted terminal page holds without fetching');
  perform public.pause_shopify_backfill_v1(s.op,s.rid,(s.claim->>'leaseToken')::uuid);
end; $$;
insert into public.products(sku,product_name,shopify_variant_id,active) values('ACCEPTANCE-UNSEEN','Unseen','gid://shopify/ProductVariant/99099',true);
update phase2a_test.recovery_state set preview=public.preview_shopify_backfill_v1(op);
create function phase2a_test.completion_fault() returns trigger language plpgsql as $$
begin
  if current_setting('snake.phase2a_completion_fault',true)=tg_table_name then
    if (to_jsonb(new)->>'status'='completed') or (to_jsonb(new)->>'completed_at' is not null) then
      raise exception using errcode='P0001',message='acceptance completion fault';
    end if;
  end if;
  return new;
end; $$;
create trigger acceptance_run_fault before update on private.sync_runs for each row execute function phase2a_test.completion_fault();
create trigger acceptance_approval_fault before update on private.shopify_backfill_operations for each row execute function phase2a_test.completion_fault();
do $$ declare s phase2a_test.recovery_state%rowtype; before_state jsonb; point text; rejected boolean; begin
  select * into s from phase2a_test.recovery_state;
  foreach point in array array['sync_runs','shopify_backfill_operations'] loop
    before_state:=phase2a_test.control_snapshot();rejected:=false;
    perform set_config('snake.phase2a_completion_fault',point,true);
    begin
      perform public.complete_shopify_backfill_v1(s.op,s.rid,s.preview,'COMPLETE '||s.op||' '||s.rid||' '||(s.preview->>'affectedDigest'));
    exception when sqlstate 'P0001' then
      if sqlerrm<>'acceptance completion fault' then raise;end if;
      rejected:=true;
    end;
    perform phase2a_test.check(rejected and phase2a_test.control_snapshot()=before_state,
      'approval/reconciliation/completion/lease/receipts all roll back at '||point);
  end loop;
end; $$;
