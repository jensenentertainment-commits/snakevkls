\set ON_ERROR_STOP on
begin;
\ir roy-phase-2a-backfill.helpers.sql
create table phase2a_test.backfill_race(worker text primary key, outcome text not null);
create function phase2a_test.delay_backfill() returns trigger language plpgsql as $$
begin perform pg_sleep(2);return new;end; $$;
create trigger delay_backfill before insert on private.shopify_backfill_operations for each row execute function phase2a_test.delay_backfill();
create function phase2a_test.admission_race(worker text) returns void language plpgsql as $$
declare op uuid:=case when worker='a' then '98000000-0000-4000-8000-000000000001'::uuid else '98000000-0000-4000-8000-000000000002'::uuid end; outcome text:='admitted'; r jsonb;
begin
 begin
  if worker='ordinary' then
   r:=public.claim_shopify_sync_run('cron');outcome:=case when r->>'acquired'='true' then 'ordinary-acquired' else 'ordinary-blocked' end;
  else
   perform public.start_shopify_backfill_v1(op,phase2a_test.backfill_identity(),'START '||op||' abcdefghijklmnopqrst fixture.myshopify.com');
  end if;
 exception when raise_exception then
  if sqlerrm<>'Existing resumable run blocks fresh admission' then raise;end if;outcome:='blocked';
 end;
 insert into phase2a_test.backfill_race values(worker,outcome);
end; $$;
commit;
