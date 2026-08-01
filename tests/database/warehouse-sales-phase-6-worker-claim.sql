\set ON_ERROR_STOP on

set role service_role;
select public.claim_warehouse_sale_shopify_sync_job(60) ->> 'jobId';

