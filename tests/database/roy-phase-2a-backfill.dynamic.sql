\set ON_ERROR_STOP on
begin;
\ir roy-phase-2a-backfill.helpers.sql
create trigger backfill_receipt_fault before insert on private.shopify_backfill_pages for each row execute function phase2a_test.inject_fault();
do $$
declare op uuid:='98000000-0000-4000-8000-000000000001'; identity jsonb:=phase2a_test.backfill_identity(); admitted jsonb; claim jsonb; rid uuid; token uuid; products jsonb; variants jsonb; preview jsonb; result jsonb; oracle jsonb; reader jsonb;
begin
 -- Existing old-writer unfinished history blocks admission without rewriting it.
 begin
   perform public.claim_shopify_sync_run('manual');
   perform phase2a_test.reject_command(format('select public.start_shopify_backfill_v1(%L,%L,%L)',op,phase2a_test.backfill_identity(),'START '||op||' abcdefghijklmnopqrst fixture.myshopify.com'),'Existing resumable');
   raise exception 'ROLLBACK_BLOCKER_FIXTURE';
 exception when raise_exception then if sqlerrm<>'ROLLBACK_BLOCKER_FIXTURE' then raise;end if;end;
 set local role service_role;
 admitted:=public.start_shopify_backfill_v1(op,identity,'START '||op||' abcdefghijklmnopqrst fixture.myshopify.com');
 reset role;
 rid:=(admitted->>'runId')::uuid;
 perform phase2a_test.check(admitted->>'pagesProcessed'='0' and admitted->>'hasNextPage'='true','genuinely fresh run');
 perform phase2a_test.check(public.start_shopify_backfill_v1(op,phase2a_test.backfill_identity(),'START '||op||' abcdefghijklmnopqrst fixture.myshopify.com')->>'runId'=rid::text,'idempotent admission');
 perform phase2a_test.reject_command(format('select public.start_shopify_backfill_v1(%L,%L,%L)',op,phase2a_test.backfill_identity()||'{"codeRevision":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}', 'START '||op||' abcdefghijklmnopqrst fixture.myshopify.com'),'identity mismatch');
 perform phase2a_test.check(public.claim_shopify_sync_run('cron')->>'acquired'='false','ordinary worker cannot acquire protected paused run');
 claim:=public.claim_shopify_backfill_v1(op,rid,'RESUME '||op||' '||rid);token:=(claim->>'leaseToken')::uuid;
 perform phase2a_test.reject_command(format('select public.complete_shopify_sync_run(%L,%L)',rid,token),'Protected operation');
 perform phase2a_test.reject_command(format('select public.pause_shopify_sync_run(%L,%L,%L)',rid,token,'ordinary'),'Protected operation');
 perform phase2a_test.reject_command(format('select public.apply_shopify_sync_page_v2(%L,%L,null,0,%L,false,%L,%L)',rid,token,'final','[]','[]'),'Protected operation');
 products:=jsonb_build_array(phase2a_test.backfill_product(98001),phase2a_test.backfill_product(98002));
 variants:=jsonb_build_array(phase2a_test.variant(98001,98001,'BACKFILL-1','[]'),phase2a_test.variant(98002,98001,'BACKFILL-2','[]'),phase2a_test.variant(98003,98002,null,'[]'));
 -- The real receipt failure must roll back canonical + legacy + seen + checkpoint.
 perform set_config('snake.phase2a_fault','private.shopify_backfill_pages',true);
 perform phase2a_test.reject_command(format('select public.apply_shopify_backfill_page_v1(%L,%L,%L,null,0,%L,true,%L,%L,%L)',op,rid,token,'first',variants,products,phase2a_test.traversal(products)),'fixture injected failure');
 perform set_config('snake.phase2a_fault','',true);
 result:=public.apply_shopify_backfill_page_v1(op,rid,token,null,0,'first',true,variants,products,phase2a_test.traversal(products));
 perform phase2a_test.check(result->>'pagesProcessed'='1' and result->>'processedCount'='2' and result->>'skippedNoSku'='1','page and counter compatibility');
 perform phase2a_test.reject_command(format('select public.apply_shopify_backfill_page_v1(%L,%L,%L,null,0,%L,true,%L,%L,%L)',op,rid,token,'first',variants,products,phase2a_test.traversal(products)),'checkpoint conflict');
 -- An incomplete refresh cannot change the prior complete zero snapshot.
 products:=jsonb_set(products,'{0,collectionObservation,state}','"incomplete"');
 perform phase2a_test.reject_command(format('select public.apply_shopify_backfill_page_v1(%L,%L,%L,%L,1,%L,false,%L,%L,%L)',op,rid,token,'first','final',variants,products,phase2a_test.traversal(products)),'Only complete');
 result:=public.apply_shopify_backfill_page_v1(op,rid,token,'first',1,'final',false,'[]','[]','[]');
 perform public.pause_shopify_backfill_v1(op,rid,token);
 perform phase2a_test.check(public.claim_shopify_backfill_v1(op,rid,'RESUME '||op||' '||rid)->>'completionHold'='true','final page cannot be refetched');
 perform phase2a_test.check(public.claim_shopify_sync_run('manual')->>'acquired'='false','ordinary manual cannot complete held run');
 perform public.recover_shopify_backfill_v1(op,rid,'RESUME '||op||' '||rid);
 perform phase2a_test.check((select recovery_reads=1 from private.shopify_backfill_operations where operation_id=op),'recovery read is durable');
 -- Add an unseen row; preview is explicitly bound to the current scope.
 insert into public.products(sku,product_name,shopify_variant_id,active) values('UNSEEN','Unseen','gid://shopify/ProductVariant/98999',true);
 preview:=public.preview_shopify_backfill_v1(op);
 perform phase2a_test.check(preview->>'activeDeactivations'='1','unseen deactivation preview');
 perform phase2a_test.reject_command(format('select public.complete_shopify_backfill_v1(%L,%L,%L,null)',op,rid,preview),'approval');
 update public.products set active=false where sku='UNSEEN';
 perform phase2a_test.reject_command(format('select public.complete_shopify_backfill_v1(%L,%L,%L,%L)',op,rid,preview,'COMPLETE '||op||' '||rid||' '||(preview->>'affectedDigest')),'preview changed');
 preview:=public.preview_shopify_backfill_v1(op);
 result:=public.complete_shopify_backfill_v1(op,rid,preview,'COMPLETE '||op||' '||rid||' '||(preview->>'affectedDigest'));
 perform phase2a_test.check(result->>'status'='completed','explicit approved completion');
 perform phase2a_test.check(public.complete_shopify_backfill_v1(op,rid,preview,'COMPLETE '||op||' '||rid||' '||(preview->>'affectedDigest'))=result,'lost completion acknowledgement safe retry');
 oracle:=public.get_shopify_backfill_proof_facts_v1(op);reader:=phase2a_test.read_foundation();
 perform phase2a_test.check(oracle->'totals'=reader->'totals' and oracle->'fields'=reader->'fields' and oracle->'collections'=reader->'collections' and oracle->'freshness'=reader->'freshness','independent aggregate agreement');
 perform phase2a_test.check(oracle#>>'{provenance,contentMismatches}'='0' and oracle#>>'{provenance,collectionMismatches}'='0' and oracle#>>'{provenance,variantMismatches}'='0' and oracle#>>'{provenance,counterAgreement}'='true','source receipt agreement');
 perform phase2a_test.check(oracle#>>'{provenance,reconciliationAgreement}'='true' and oracle#>>'{provenance,sourceEvidenceValid}'='true','terminal provenance and reconciliation');
 perform phase2a_test.check(phase2a_test.read_target('BACKFILL-1')#>>'{canonicalCollections,membershipCount}'='0','complete zero targeted proof');
 -- Oracle independently handles missing canonical rows, incomplete rows, Unicode,
 -- duplicate product variants and bounded oversized collection samples.
 perform phase2a_test.seed_foundation_product(98101,false,false,0);
 perform phase2a_test.seed_foundation_product(98102,true,false,3);
 perform phase2a_test.seed_foundation_product(98103,true,true,30);
 update public.shopify_product_content set description=U&'\00A0\FEFF' where shopify_product_id='gid://shopify/Product/98103';
 oracle:=public.get_shopify_backfill_proof_facts_v1(op);reader:=phase2a_test.read_foundation();
 perform phase2a_test.check(oracle->'totals'=reader->'totals' and oracle->'fields'=reader->'fields' and oracle->'collections'=reader->'collections' and oracle->'freshness'=reader->'freshness','mixed independent aggregate agreement');
 perform phase2a_test.check(oracle#>>'{provenance,activeProductsWithoutReceipt}'='3','unattributed observations cannot pass manifest coverage');
 perform phase2a_test.check(phase2a_test.read_target('CF-98102')#>>'{canonicalCollections,state}'='unknown_or_incomplete','incomplete rows do not fill coverage');
 perform phase2a_test.check(phase2a_test.read_target('CF-98103')#>>'{canonicalCollections,membershipCount}'='30','exact count survives truncation');
 -- NULL CHECK regression and Unicode missing categories.
 perform phase2a_test.reject_command($s$update public.shopify_product_content set shopify_category_id=null where shopify_product_id='gid://shopify/Product/98001'$s$,'shopify_product_content_category_valid');
 perform phase2a_test.reject_command($s$update public.shopify_product_content set shopify_category_full_name=null where shopify_product_id='gid://shopify/Product/98001'$s$,'shopify_product_content_category_valid');
 perform phase2a_test.reject_command($s$update public.shopify_product_content set shopify_category_full_name=U&'\00A0\FEFF' where shopify_product_id='gid://shopify/Product/98001'$s$,'shopify_product_content_category_valid');
 -- Metadata-only creation is not activation; ordinary new runs still work after completion.
 perform phase2a_test.check(public.claim_shopify_sync_run('manual')->>'acquired'='true','ordinary fresh sync remains available');
end; $$;
-- Verify service/API privileges independently of function bodies.
select phase2a_test.check(not has_function_privilege('authenticated','public.start_shopify_backfill_v1(uuid,jsonb,text)','execute'),'users cannot mutate operations');
select phase2a_test.check(not has_function_privilege('anon','public.get_shopify_backfill_proof_facts_v1(uuid)','execute'),'anonymous oracle denied');
select phase2a_test.check(not has_function_privilege('service_role','private.apply_shopify_sync_page_v2(uuid,uuid,text,integer,text,boolean,jsonb,jsonb,integer)','execute'),'private writer not an API bypass');
select phase2a_test.check(not has_function_privilege('service_role','public.get_roy_catalog_foundation_v1()','execute'),'Roy reader is not service-role retrieval');
rollback;
