-- DRAFT / NOT APPLIED. Manual autocommit maintenance migration.
-- Run EACH statement separately, outside BEGIN/COMMIT and transaction-wrapped runners.
-- Preflight: pg_indexes must show no equivalent leading-column index; inspect invalid
-- indexes by name. IF NOT EXISTS does NOT repair an invalid or differently defined index.
-- Sequential builds avoid concurrent builds on the same table.
create index concurrently if not exists ad_orders_product_id_idx on public.ad_orders (product_id);
create index concurrently if not exists ad_orders_rejected_by_idx on public.ad_orders (rejected_by);
create index concurrently if not exists ad_orders_reviewed_by_idx on public.ad_orders (reviewed_by);
create index concurrently if not exists admin_audit_log_actor_id_idx on public.admin_audit_log (actor_id);
-- Verify all four pg_index.indisvalid / indisready values and actual index definitions.
-- On failed build: investigate; repair/drop ONLY the new invalid index after approval.
-- No existing index is removed. Additional write/storage cost; benefit is FK checks
-- during referenced product/profile updates/deletes and actor/product lookups.
