-- UI fixtures only. Execute as one transaction on pinned snake-test AFTER
-- preview.ps1 -CreateUser. Not a migration or an acceptance-test fixture.
begin;
do $$
declare actor uuid; o uuid; j uuid; ol uuid; pl uuid; prod uuid; inv uuid; loc uuid; i integer; k integer;
begin
 if (select system_identifier::text from pg_control_system()) <> '7702071863184491885'
   or current_database() <> 'postgres' then raise exception 'Wrong preview target'; end if;
 if (select count(*) from auth.users) <> 1
   or not exists(select 1 from auth.users where email='viper-ui@example.test' and email_confirmed_at is not null)
   or exists(select 1 from public.orders) or exists(select 1 from public.products)
   or exists(select 1 from public.inventory) or exists(select 1 from public.shopify_connections)
   or exists(select 1 from public.pick_jobs)
   or exists(select 1 from public.zones where code='VUI' or pick_priority=200)
 then raise exception 'Unexpected population; no automatic reset or reseed'; end if;
 select id into strict actor from auth.users where email='viper-ui@example.test';
 if exists(select 1 from public.profiles where id<>actor or email is distinct from 'viper-ui@example.test') then
   raise exception 'Unexpected profiles'; end if;
 insert into public.profiles(id,email,role,display_name,active)
 values(actor,'viper-ui@example.test','admin','Viper UI-test · snake-test',true)
 on conflict(id) do update set role='admin',display_name=excluded.display_name,active=true;
 insert into public.zones(id,code,name,pick_priority) values
 ('92000000-0000-4000-8000-000000000001','VUI','Syntetisk UI-testlager',200);
 for k in 1..2 loop
   prod:=('94000000-0000-4000-8000-'||lpad(k::text,12,'0'))::uuid;
   loc:=('93000000-0000-4000-8000-'||lpad(k::text,12,'0'))::uuid;
   inv:=('95000000-0000-4000-8000-'||lpad(k::text,12,'0'))::uuid;
   insert into public.locations(id,zone_id,code,active,pick_sequence,location_purpose)
   values(loc,'92000000-0000-4000-8000-000000000001','VUI01-0'||k||'-A',true,k,'PICK');
   insert into public.products(id,sku,product_name,variant_name,active)
   values(prod,'VUI-'||k,case when k=1 then 'Syntetisk arbeidslampe med langt produktnavn' else 'Syntetisk oppbevaringsboks' end,
     case when k=1 then 'Blå / stor' else 'Standard' end,true);
   insert into public.inventory(id,product_id,location_id,zone_id,quantity,is_primary)
   values(inv,prod,loc,'92000000-0000-4000-8000-000000000001',30,true);
 end loop;
 for i in 1..3 loop
   o:=('96000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
   j:=('97000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
   insert into public.orders(id,source,external_order_id,order_number,status,ready_at)
   values(o,'manual','VUI-'||i,'UI-TEST-'||i,'ready_to_pick',now());
   insert into public.pick_jobs(id,order_id) values(j,o);
   for k in 1..2 loop
     prod:=('94000000-0000-4000-8000-'||lpad(k::text,12,'0'))::uuid;
     loc:=('93000000-0000-4000-8000-'||lpad(k::text,12,'0'))::uuid;
     inv:=('95000000-0000-4000-8000-'||lpad(k::text,12,'0'))::uuid;
     ol:=('98000000-0000-4000-8000-'||lpad((i*10+k)::text,12,'0'))::uuid;
     pl:=('99000000-0000-4000-8000-'||lpad((i*10+k)::text,12,'0'))::uuid;
     insert into public.order_lines(id,order_id,external_line_id,product_id,sku,product_name,variant_name,requested_quantity)
     select ol,o,'VUI-L'||k,id,sku,product_name,variant_name,k+1 from public.products where id=prod;
     insert into public.pick_lines(id,pick_job_id,order_line_id,product_id,inventory_id,location_id,expected_quantity,sequence_number)
     values(pl,j,ol,prod,inv,loc,k+1,k);
   end loop;
 end loop;
 -- Seed representative states through the existing fenced commands, not state overrides.
 j:='97000000-0000-4000-8000-000000000003';
 perform public.apply_viper_pick_command(j,0,gen_random_uuid(),'cancel',
   '{"reason":"Syntetisk gjenopprettingseksempel; ingen varer tatt ut","physicalReturnConfirmed":true}',actor);
 j:='97000000-0000-4000-8000-000000000001';
 perform public.apply_viper_pick_command(j,0,gen_random_uuid(),'start','{}',actor);
 perform public.apply_viper_pick_command(j,1,gen_random_uuid(),'report',
   '{"lineId":"99000000-0000-4000-8000-000000000011","exceptionType":"wrong_quantity","observedQuantity":1,"note":"Syntetisk avvik for visuell kontroll"}',actor);
 if (select count(*) from public.orders)<>3 or (select count(*) from public.pick_lines)<>6
   or (select sum(quantity) from public.inventory)<>60 then raise exception 'Fixture verification failed'; end if;
end $$;
commit;
