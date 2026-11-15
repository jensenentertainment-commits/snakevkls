-- Package A only. No data rewrite, count sessions or changes to shared stock RPCs.
create function public.save_product_placement_v2(
  requested_action text, requested_product_id uuid, requested_inventory_id uuid,
  requested_location_id uuid, expected_location_id uuid, expected_zone_id uuid,
  expected_quantity integer, expected_updated_at timestamptz, requested_quantity integer,
  requested_actor_id uuid, requested_actor_email text, requested_actor_name text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.inventory%rowtype;
  saved_row public.inventory%rowtype;
  target public.locations%rowtype;
  product_label text;
  before_quantity integer := 0;
  movement_id uuid;
begin
  if requested_action is null or requested_action not in ('place','register','quantity') then
    raise exception 'Invalid placement action' using errcode='22023';
  end if;
  if requested_action='place' and (requested_quantity is not null or expected_quantity is not null or expected_updated_at is not null) then
    raise exception 'Placement must not contain quantity' using errcode='22023';
  end if;
  if requested_action in ('register','quantity') and (requested_quantity is null or requested_quantity < 0) then
    raise exception 'Invalid quantity' using errcode='22023';
  end if;
  if (requested_action='register' and requested_inventory_id is not null)
     or (requested_action<>'register' and requested_inventory_id is null) then
    raise exception 'Invalid inventory identity' using errcode='22023';
  end if;

  -- Same product-first order as existing placement/add-to-location functions.
  select product_name into product_label from public.products
    where id=requested_product_id for update;
  if not found then raise exception 'Product not found' using errcode='22023'; end if;
  select * into target from public.locations where id=requested_location_id for share;
  if not found or not target.active or target.zone_id is null then
    raise exception 'Location not found, inactive or without zone' using errcode='22023';
  end if;
  perform 1 from public.zones where id=target.zone_id for key share;
  if not found then raise exception 'Zone not found' using errcode='22023'; end if;

  if requested_action='register' then
    -- A stale first-registration dialog must not create another inventory row.
    if exists(select 1 from public.inventory where product_id=requested_product_id) then
      raise exception 'Inventory changed; reload' using errcode='40001';
    end if;
    insert into public.inventory(product_id,location_id,zone_id,quantity,is_primary)
      values(requested_product_id,target.id,target.zone_id,requested_quantity,true)
      returning * into saved_row;
  else
    select * into current_row from public.inventory where id=requested_inventory_id for update;
    if not found or current_row.product_id<>requested_product_id then
      raise exception 'Inventory row does not belong to product' using errcode='22023';
    end if;
    if current_row.location_id is distinct from expected_location_id
       or current_row.zone_id is distinct from expected_zone_id then
      raise exception 'Placement changed; reload' using errcode='40001';
    end if;
    before_quantity := current_row.quantity;
    if requested_action='quantity' then
      if expected_quantity is null or expected_updated_at is null
         or current_row.quantity<>expected_quantity or current_row.updated_at<>expected_updated_at then
        raise exception 'Inventory changed; reload' using errcode='40001';
      end if;
      update public.inventory set location_id=target.id, zone_id=target.zone_id,
        quantity=requested_quantity, updated_at=clock_timestamp()
        where id=current_row.id returning * into saved_row;
    else
      -- Intentionally no assignment to quantity, even if it changed since the UI read.
      update public.inventory set location_id=target.id, zone_id=target.zone_id,
        updated_at=clock_timestamp()
        where id=current_row.id returning * into saved_row;
    end if;
  end if;

  if requested_action<>'place' and saved_row.quantity<>before_quantity then
    insert into public.stock_movements(product_id,inventory_id,quantity_delta,reason,note)
      values(requested_product_id,saved_row.id,saved_row.quantity-before_quantity,'correction',
        case when requested_action='register' then 'Førstegangsregistrering' else 'Eksplisitt antallsendring' end)
      returning id into movement_id;
  end if;
  insert into public.activity_log(entity_type,entity_id,action,title,description,metadata,actor_id,actor_email,actor_name)
    values('inventory',saved_row.id,'location_set','Plassering registrert',product_label || ' → ' || target.code,
      jsonb_build_object('productId',requested_product_id,'product_id',requested_product_id,
        'inventoryId',saved_row.id,'operation',requested_action,'movementId',movement_id,
        'fromLocationId',current_row.location_id,'locationId',target.id,'zoneId',target.zone_id,
        'previousQuantity',before_quantity,'newQuantity',saved_row.quantity),
      requested_actor_id,requested_actor_email,requested_actor_name);
  return jsonb_build_object('inventoryId',saved_row.id,'quantity',saved_row.quantity,'movementId',movement_id);
end; $$;
revoke all on function public.save_product_placement_v2(text,uuid,uuid,uuid,uuid,uuid,integer,timestamptz,integer,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_product_placement_v2(text,uuid,uuid,uuid,uuid,uuid,integer,timestamptz,integer,uuid,text,text) to service_role;

-- Known callers documented in docs/operations/warehouse-package-a-and-count-locks.md.
-- Fail closed for old deployments as well as old browser tabs. Do not run old SQL again.
create or replace function public.set_product_location(
  requested_product_id uuid, requested_inventory_id uuid, requested_zone_id uuid,
  requested_location_id uuid, requested_quantity integer,
  requested_actor_id uuid default null, requested_actor_email text default null, requested_actor_name text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  raise exception 'Legacy placement retired; reload the current application' using errcode='0A000';
end; $$;
revoke all on function public.set_product_location(uuid,uuid,uuid,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
