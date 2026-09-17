\set ON_ERROR_STOP on
begin;
\ir roy-phase-2a-sync-persistence.helpers.sql
select phase2a_test.check(not exists (select 1 from private.sync_runs), 'fresh disposable migrated database required');
select phase2a_test.check(not exists (select 1 from public.products), 'no existing catalog data allowed');

create table phase2a_test.claim as
select public.claim_shopify_sync_run('manual', 'concurrency@phase2a.test', 300) as value;
create table phase2a_test.results (worker text primary key, outcome text not null);

-- Hold the real run row lock while both clients attempt the same page.
create function phase2a_test.delay_content() returns trigger language plpgsql as $$
begin
  perform pg_sleep(2);
  return new;
end;
$$;
create trigger phase2a_delay_content before insert on public.shopify_product_content
for each row execute function phase2a_test.delay_content();

create function phase2a_test.concurrent_apply(worker text) returns void language plpgsql as $$
declare
  claim jsonb := (select value from phase2a_test.claim);
  outcome text := 'committed';
begin
  begin
    perform public.apply_shopify_sync_page_v2(
      (claim ->> 'runId')::uuid, (claim ->> 'leaseToken')::uuid,
      null, 0, 'one-page', true,
      jsonb_build_array(phase2a_test.variant(92001, 92001, 'CONCURRENT-P2A')),
      jsonb_build_array(phase2a_test.product(92001)), 300
    );
  exception when raise_exception then
    if sqlerrm <> 'Shopify sync checkpoint conflict' then raise; end if;
    outcome := 'checkpoint-conflict';
  end;
  insert into phase2a_test.results values (worker, outcome);
end;
$$;
commit;
