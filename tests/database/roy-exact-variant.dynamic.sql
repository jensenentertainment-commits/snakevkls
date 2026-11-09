\set ON_ERROR_STOP on
begin;
set local snake.phase2a_isolated = 'on';
\ir roy-phase-2a-acceptance.guard.sql
\ir ../../supabase/migrations/20261109182708_roy_exact_variant_reader.sql
-- This fixture owns only synthetic rows inside the rolled-back transaction.
insert into auth.users(id) values ('97000000-0000-4000-8000-000000000091');
insert into public.profiles(id,email,role,display_name,active) values
('97000000-0000-4000-8000-000000000091','variant-reader@example.test','admin','Synthetic reader',true);
insert into public.products(shopify_product_id,shopify_variant_id,product_name,sku,active) values
('gid://shopify/Product/9791001','gid://shopify/ProductVariant/9791001','Without SKU',null,true),
('gid://shopify/Product/9791002','gid://shopify/ProductVariant/9791002','Duplicate A','ROY-DUPLICATE',true),
('gid://shopify/Product/9791003','gid://shopify/ProductVariant/9791003','Duplicate B','ROY-DUPLICATE',true),
('gid://shopify/Product/9791004','gid://shopify/ProductVariant/9791004','Inactive',null,false);
select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000091',true);
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.get_roy_targeted_variant_v1('gid://shopify/ProductVariant/9791001');
  if r->>'status' <> 'found' or r#>>'{selectedVariant,sku}' is not null then raise exception 'NULL SKU lookup failed'; end if;
  if r#>>'{productContent,fields,description,state}' <> 'unknown' then raise exception 'Unknown content lost'; end if;
  if public.get_roy_targeted_product_v1('ROY-DUPLICATE')->>'status' <> 'ambiguous' then raise exception 'SKU ambiguity lost'; end if;
  if public.get_roy_targeted_variant_v1('gid://shopify/ProductVariant/9791002')#>>'{selectedVariant,productName}' <> 'Duplicate A' then raise exception 'Wrong variant'; end if;
  if public.get_roy_targeted_variant_v1('gid://shopify/ProductVariant/9791004')->>'status' <> 'not_found' then raise exception 'Inactive variant exposed'; end if;
  if public.get_roy_targeted_variant_v1('gid://shopify/ProductVariant/9791999')->>'status' <> 'not_found' then raise exception 'Absent variant fallback'; end if;
  begin perform public.get_roy_targeted_variant_v1('9791001'); raise exception 'Malformed ID accepted'; exception when invalid_parameter_value then null; end;
  if has_function_privilege('anon','public.get_roy_targeted_variant_v1(text)','EXECUTE') then raise exception 'anon grant'; end if;
  if has_function_privilege('service_role','public.get_roy_targeted_variant_v1(text)','EXECUTE') then raise exception 'service role grant'; end if;
  if (select prosecdef from pg_proc where oid='public.get_roy_targeted_variant_v1(text)'::regprocedure) then raise exception 'Security definer'; end if;
end $$;
reset role;
update public.profiles set role='warehouse' where id='97000000-0000-4000-8000-000000000091';
set local role authenticated;
do $$ begin
  begin perform public.get_roy_targeted_variant_v1('gid://shopify/ProductVariant/9791001'); raise exception 'Warehouse role accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set role='user',active=true where id='97000000-0000-4000-8000-000000000091';
set local role authenticated;
do $$ begin
  if public.get_roy_targeted_variant_v1('gid://shopify/ProductVariant/9791001')->>'status' <> 'found' then raise exception 'Active user denied'; end if;
end $$;
reset role;
update public.profiles set active=false where id='97000000-0000-4000-8000-000000000091';
set local role authenticated;
do $$ begin
  begin perform public.get_roy_targeted_variant_v1('gid://shopify/ProductVariant/9791001'); raise exception 'Inactive user accepted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Roy exact-variant assertions passed; schema and fixtures rolled back' as result;
