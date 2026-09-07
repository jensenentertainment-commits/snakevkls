-- Roy Phase 2A: additive Shopify product-content foundation.
-- public.products remains the variant-level authority. The existing
-- public.product_collections table remains compatibility infrastructure.
-- This migration intentionally performs no backfill and marks no source data
-- as observed or complete.

create table public.shopify_product_content (
  shopify_product_id text primary key,
  product_name text,
  description text,
  seo_title text,
  seo_description text,
  product_handle text,
  product_type text,
  shopify_category_id text,
  shopify_category_full_name text,
  vendor text,
  shopify_status text,
  image_url text,
  shopify_updated_at timestamptz,
  content_observed_at timestamptz,
  collections_observed_at timestamptz,
  collections_complete boolean not null default false,
  synced_at timestamptz,

  constraint shopify_product_content_product_id_valid check (
    shopify_product_id ~ '^gid://shopify/Product/[0-9]+$'
  ),
  constraint shopify_product_content_observation_valid check (
    (
      content_observed_at is null
      and product_name is null
      and description is null
      and seo_title is null
      and seo_description is null
      and product_handle is null
      and product_type is null
      and shopify_category_id is null
      and shopify_category_full_name is null
      and vendor is null
      and shopify_status is null
      and image_url is null
      and shopify_updated_at is null
      and synced_at is null
    )
    or
    (
      content_observed_at is not null
      and nullif(btrim(product_name), '') is not null
      and description is not null
      and nullif(btrim(product_handle), '') is not null
      and nullif(btrim(shopify_status), '') is not null
      and shopify_updated_at is not null
      and synced_at is not null
    )
  ),
  constraint shopify_product_content_category_valid check (
    (
      shopify_category_id is null
      and shopify_category_full_name is null
    )
    or
    (
      shopify_category_id
        ~ '^gid://shopify/TaxonomyCategory/[A-Za-z0-9_-]+$'
      and nullif(btrim(shopify_category_full_name), '') is not null
    )
  ),
  constraint shopify_product_content_collections_observation_valid check (
    collections_complete is false
    or collections_observed_at is not null
  )
);

create unique index shopify_product_content_handle_key
  on public.shopify_product_content (product_handle)
  where product_handle is not null;

create index shopify_product_content_product_type_idx
  on public.shopify_product_content (product_type);

create index shopify_product_content_category_id_idx
  on public.shopify_product_content (shopify_category_id)
  where shopify_category_id is not null;

create index shopify_product_content_unobserved_idx
  on public.shopify_product_content (shopify_product_id)
  where content_observed_at is null;

create index shopify_product_content_incomplete_collections_idx
  on public.shopify_product_content (shopify_product_id)
  where collections_complete is false;

create table public.shopify_product_collections (
  shopify_product_id text not null,
  shopify_collection_id text not null,
  title text not null,
  handle text,

  constraint shopify_product_collections_pkey primary key (
    shopify_product_id,
    shopify_collection_id
  ),
  constraint shopify_product_collections_product_fkey foreign key (
    shopify_product_id
  ) references public.shopify_product_content(shopify_product_id)
    on delete cascade,
  constraint shopify_product_collections_collection_id_valid check (
    shopify_collection_id ~ '^gid://shopify/Collection/[0-9]+$'
  ),
  constraint shopify_product_collections_title_valid check (
    nullif(btrim(title), '') is not null
  )
);

create index shopify_product_collections_collection_id_idx
  on public.shopify_product_collections (shopify_collection_id);

create index shopify_product_collections_handle_idx
  on public.shopify_product_collections (handle)
  where handle is not null;

alter table public.shopify_product_content enable row level security;
alter table public.shopify_product_collections enable row level security;

create policy "Business roles read Shopify product content"
on public.shopify_product_content for select to authenticated
using ((select private.has_role(array['admin', 'user']::text[])));

create policy "Business roles read Shopify product collections"
on public.shopify_product_collections for select to authenticated
using ((select private.has_role(array['admin', 'user']::text[])));

revoke all on table
  public.shopify_product_content,
  public.shopify_product_collections
from public, anon, authenticated;

grant select on table
  public.shopify_product_content,
  public.shopify_product_collections
to authenticated;

grant all privileges on table
  public.shopify_product_content,
  public.shopify_product_collections
to service_role;
