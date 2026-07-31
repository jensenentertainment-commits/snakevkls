\set ON_ERROR_STOP on
set role postgres;

create function public.viper_p4_test_delay_order()
returns trigger language plpgsql as $$
begin
  if new.external_order_id = 'gid://shopify/Order/9010' then
    perform pg_sleep(0.75);
  end if;
  return new;
end;
$$;
create trigger viper_p4_test_delay_order
before insert on public.orders
for each row execute function public.viper_p4_test_delay_order();
