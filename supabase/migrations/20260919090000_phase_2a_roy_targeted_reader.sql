-- Inactive Commit 7 reader. Forward migration only; no production activation.
-- CLI unavailable and installation prohibited: migration authored offline.
create function private.roy_preview_v1(value text, max_chars integer)
returns text language sql immutable security invoker set search_path = ''
as $$
  select case when value ~* 'gid://shopify/' then null
    else left(regexp_replace(value, U&'[\0001-\001F\007F-\009F]', ' ', 'g'), max_chars) end;
$$;
revoke all on function private.roy_preview_v1(text, integer) from public, anon, service_role;
grant execute on function private.roy_preview_v1(text, integer) to authenticated;

create function public.get_roy_targeted_product_v1(requested_sku text)
returns jsonb language plpgsql stable security invoker
set search_path = '' set timezone = 'UTC'
as $$
declare
  trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  selected public.products%rowtype;
  content public.shopify_product_content%rowtype;
  matches integer;
  total_variants bigint;
  total_members bigint;
  result jsonb;
  fields jsonb := '{}'::jsonb;
  siblings jsonb := '[]'::jsonb;
  names jsonb := '[]'::jsonb;
  field record;
  variant public.products%rowtype;
  member record;
  variant_json jsonb;
  selected_json jsonb;
  preview text;
  field_state text;
  complete boolean;
  display_truncated boolean := false;
begin
  if (select private.has_role(array['admin', 'user']::text[])) is not true then
    raise exception using errcode = '42501', message = 'Roy targeted reader requires an active admin or user';
  end if;
  if requested_sku is null or nullif(btrim(requested_sku, trim_chars), '') is null
    or char_length(requested_sku) > 512 then
    raise exception using errcode = '22023', message = 'Invalid SKU input';
  end if;

  -- STABLE: all reads use the calling statement snapshot, including membership
  -- and content metadata during concurrent transactional page replacement.
  select count(*) into matches from (
    select p.id from public.products p
    where p.active = true and p.shopify_product_id is not null and p.sku = requested_sku
    limit 2
  ) candidates;
  result := jsonb_build_object(
    'schemaVersion', 1, 'source', 'roy_targeted_product_v1',
    'scopeAuthority', 'snake_products_active_shopify_linked',
    'status', case when matches = 0 then 'not_found' when matches > 1 then 'ambiguous' else 'found' end,
    'generatedAt', statement_timestamp(), 'selectedVariant', null, 'siblingVariants', '[]'::jsonb,
    'variantCount', 0, 'siblingsTruncated', false, 'productContent', null, 'canonicalCollections', null,
    'budgetLimited', false,
    'limits', jsonb_build_object('maxCollections', 24, 'maxSiblings', 24, 'maxResponseBytes', 32768),
    'limitations', jsonb_build_array(
      'Snake''s persisted active Shopify-linked catalog; not live Shopify verification.',
      'Last successful observations; not the result of the latest refresh attempt.',
      'SEO fields are explicit merchant overrides; missing overrides do not prove missing rendered metadata.',
      'A handle does not prove a public URL resolves. Presence is not quality or correctness.'
    )
  );
  if matches <> 1 then return result; end if;
  select p.* into strict selected from public.products p
  where p.active = true and p.shopify_product_id is not null and p.sku = requested_sku;
  select c.* into content from public.shopify_product_content c
  where c.shopify_product_id = selected.shopify_product_id;
  complete := coalesce(content.collections_complete, false);

  if (content.content_observed_at is not null and (
    content.shopify_updated_at is null or content.synced_at is null
    or not isfinite(content.content_observed_at) or not isfinite(content.shopify_updated_at) or not isfinite(content.synced_at)
    or ((content.shopify_category_id is null and content.shopify_category_full_name is null)
      or (content.shopify_category_id ~ '^gid://shopify/TaxonomyCategory/[A-Za-z0-9_-]+$'
        and nullif(btrim(content.shopify_category_full_name, trim_chars), '') is not null)) is not true
  )) or (complete and (content.collections_observed_at is null or not isfinite(content.collections_observed_at))) then
    raise exception using errcode = '22000', message = 'Invalid canonical observation';
  end if;

  for field in select * from (values
    ('productName', content.product_name, 512), ('description', content.description, 2048),
    ('seoTitleOverride', content.seo_title, 512), ('seoDescriptionOverride', content.seo_description, 512),
    ('productHandle', content.product_handle, 512), ('productType', content.product_type, 512),
    ('shopifyCategory', content.shopify_category_full_name, 512), ('imageReference', content.image_url, 512)
  ) f(name, value, max_chars) loop
    -- Classify the COMPLETE stored value before preview trimming or withholding.
    field_state := case when content.content_observed_at is null then 'unknown'
      when nullif(btrim(field.value, trim_chars), '') is null then 'missing' else 'present' end;
    preview := case when field_state = 'present' then private.roy_preview_v1(field.value, field.max_chars) end;
    if field_state = 'present' and char_length(field.value) <= field.max_chars
      and nullif(btrim(preview, trim_chars), '') is null then preview := null; end if;
    fields := fields || jsonb_build_object(field.name, jsonb_build_object(
      'state', field_state, 'value', preview,
      'truncated', field_state = 'present' and preview is not null and char_length(field.value) > field.max_chars,
      'withheld', field_state = 'present' and preview is null
    ));
  end loop;
  select count(*) into total_variants from public.products p
  where p.active = true and p.shopify_product_id = selected.shopify_product_id;
  -- Selected variant is first and stored separately; up to 24 OTHER summaries.
  for variant in select p.* from public.products p
    where p.active = true and p.shopify_product_id = selected.shopify_product_id
    order by (p.id = selected.id) desc, p.sku collate "C" nulls last, p.id limit 25
  loop
    if (variant.synced_at is not null and not isfinite(variant.synced_at))
      or (variant.shopify_inventory_observed_at is not null and not isfinite(variant.shopify_inventory_observed_at)) then
      raise exception using errcode = '22000', message = 'Invalid variant observation';
    end if;
    variant_json := jsonb_build_object(
      'sku', private.roy_preview_v1(variant.sku, 120),
      'productName', private.roy_preview_v1(variant.product_name, 240),
      'variantName', private.roy_preview_v1(nullif(variant.variant_name, 'Default Title'), 240),
      'priceMinor', variant.shopify_price_minor, 'currency', private.roy_preview_v1(variant.shopify_price_currency, 12),
      'quantity', variant.shopify_quantity, 'inventoryTracked', variant.shopify_inventory_tracked,
      'inventoryObservedAt', variant.shopify_inventory_observed_at, 'syncedAt', variant.synced_at,
      'textTruncated', coalesce(char_length(variant.sku) > 120 or char_length(variant.product_name) > 240
        or char_length(variant.variant_name) > 240 or char_length(variant.shopify_price_currency) > 12
        or concat_ws('', variant.sku, variant.product_name, variant.variant_name, variant.shopify_price_currency) ~* 'gid://shopify/', false)
    );
    if variant.id = selected.id then selected_json := variant_json;
    else siblings := siblings || jsonb_build_array(variant_json); end if;
  end loop;
  if complete then
    select count(*) into total_members from public.shopify_product_collections m
    where m.shopify_product_id = selected.shopify_product_id;
    for member in select m.title from public.shopify_product_collections m
      where m.shopify_product_id = selected.shopify_product_id
      order by m.shopify_collection_id collate "C" limit 24
    loop
      preview := private.roy_preview_v1(member.title, 240);
      if nullif(btrim(preview, trim_chars), '') is not null then
        names := names || jsonb_build_array(preview);
      end if;
      display_truncated := display_truncated or preview is null or char_length(member.title) > 240;
    end loop;
    display_truncated := display_truncated or total_members > jsonb_array_length(names);
  end if;
  result := result || jsonb_build_object(
    'selectedVariant', selected_json, 'siblingVariants', siblings, 'variantCount', total_variants,
    'siblingsTruncated', total_variants > 1 + jsonb_array_length(siblings),
    'productContent', jsonb_build_object('fields', fields, 'contentObservedAt', content.content_observed_at,
      'shopifyUpdatedAt', case when content.content_observed_at is not null then content.shopify_updated_at end,
      'persistedAt', case when content.content_observed_at is not null then content.synced_at end),
    'canonicalCollections', jsonb_build_object('state', case when complete then 'complete' else 'unknown_or_incomplete' end,
      'observedAt', case when complete then content.collections_observed_at end,
      'membershipCount', case when complete then total_members end,
      'names', names, 'displayTruncated', display_truncated)
  );
  -- Deterministic byte allocation: retain selected facts + states/counts first;
  -- drop sibling tail, then collection tail, then previews in fixed field order.
  while octet_length(convert_to(result::text, 'UTF8')) > 32768 loop
    result := jsonb_set(result, '{budgetLimited}', 'true');
    if jsonb_array_length(result -> 'siblingVariants') > 0 then
      result := jsonb_set(result, '{siblingVariants}', (result -> 'siblingVariants') - (jsonb_array_length(result -> 'siblingVariants') - 1));
      result := jsonb_set(result, '{siblingsTruncated}', 'true');
    elsif jsonb_array_length(result #> '{canonicalCollections,names}') > 0 then
      result := jsonb_set(result, '{canonicalCollections,names}', (result #> '{canonicalCollections,names}') - (jsonb_array_length(result #> '{canonicalCollections,names}') - 1));
      result := jsonb_set(result, '{canonicalCollections,displayTruncated}', 'true');
    else
      preview := null;
      for field in select unnest(array['description','seoDescriptionOverride','seoTitleOverride','imageReference','shopifyCategory','productType','productHandle','productName']) as name loop
        if result #> array['productContent','fields',field.name,'value'] <> 'null'::jsonb then
          result := jsonb_set(result, array['productContent','fields',field.name,'value'], 'null');
          result := jsonb_set(result, array['productContent','fields',field.name,'withheld'], 'true');
          result := jsonb_set(result, array['productContent','fields',field.name,'truncated'], 'false');
          preview := field.name;
          exit;
        end if;
      end loop;
      if preview is null then raise exception using errcode = '54000', message = 'Targeted response cannot fit byte budget'; end if;
    end if;
  end loop;
  return result;
end;
$$;
revoke all on function public.get_roy_targeted_product_v1(text) from public, anon, service_role;
grant execute on function public.get_roy_targeted_product_v1(text) to authenticated;
