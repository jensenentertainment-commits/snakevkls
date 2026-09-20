\set ON_ERROR_STOP on
\ir roy-phase-2a-targeted.helpers.sql
select phase2a_test.check(not exists(select 1 from private.sync_runs),'empty isolated run state required');
insert into public.shopify_connections(shop,access_token,inventory_location_id)
values('fixture.myshopify.com','offline-fixture-not-a-token','gid://shopify/Location/91001');
create function phase2a_test.backfill_identity() returns jsonb language sql as $$
 select jsonb_build_object('projectRef','abcdefghijklmnopqrst','supabaseUrl','https://abcdefghijklmnopqrst.supabase.co',
 'shop','fixture.myshopify.com','locationId','gid://shopify/Location/91001','codeRevision',repeat('a',40),'contractVersion','phase2a_backfill_v1','runtimeGateDisabled',true);
$$;
create function phase2a_test.backfill_product(id integer, members jsonb default '[]') returns jsonb language sql as $$
 select jsonb_set(jsonb_set(phase2a_test.product(id,members),'{productContent,contentObservedAt}',to_jsonb(clock_timestamp())),
   '{collectionObservation,observedAt}',to_jsonb(clock_timestamp()));
$$;
create function phase2a_test.traversal(products jsonb) returns jsonb language sql as $$
 select coalesce(jsonb_agg(jsonb_build_object('productId',p.value#>>'{productContent,shopifyProductId}','pageCount',1,'finalHasNextPage',false,
   'membershipCount',jsonb_array_length(p.value#>'{collectionObservation,collections}'),'observedAt',p.value#>>'{collectionObservation,observedAt}','cursorDigest',repeat('a',64))),'[]') from jsonb_array_elements(products) p;
$$;
create function phase2a_test.reject_command(statement text, expected_error text) returns void language plpgsql as $$
declare rejected boolean:=false; before_state jsonb:=phase2a_test.snapshot(); receipts bigint:=(select count(*) from private.shopify_backfill_pages);
begin
 begin execute statement; exception when others then rejected:=true;perform phase2a_test.check(position(expected_error in sqlerrm)>0,'unexpected rejection: '||sqlerrm);end;
 perform phase2a_test.check(rejected,'command must fail closed');
 perform phase2a_test.check(phase2a_test.snapshot()=before_state and receipts=(select count(*) from private.shopify_backfill_pages),'rejected command rolled back page and receipts');
end; $$;
