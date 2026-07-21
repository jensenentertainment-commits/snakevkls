# Phase 4: Database baseline

## Scope

This phase makes the application-owned production schema reproducible from
`supabase/migrations`. It does not change application code or the Phase 1-3
authorization, Shopify sync, or inventory-integrity behavior.

Production was inspected read-only through PostgreSQL system catalogs. No
production migration or data-changing statement was run.

## Missing objects

The existing migration chain started with Phase 1 `ALTER TABLE` statements and
therefore assumed that the following pre-existing `public` objects already
existed:

- 11 tables: `products`, `profiles`, `zones`, `locations`, `inventory`,
  `stock_movements`, `activity_log`, `product_collections`,
  `shopify_connections`, `snakeboard_messages`, and `location_counts`
- 110 columns, including the generated stored column
  `location_counts.difference`
- the tables' primary keys, foreign keys, unique constraints, and check
  constraints
- nine non-constraint indexes
- RLS enabled on all 11 tables
- the two pre-Phase-1 read policies on `products` and
  `product_collections`
- the table grants used by `anon`, `authenticated`, and `service_role`

No application-owned triggers were present in `public` or `private`.

## Baseline migration

`20260719000000_phase_0_database_baseline.sql` creates the missing objects
before Phase 1. Phase 1-3 remain responsible for their existing behavior.

The baseline deliberately preserves the two pairs of duplicate named unique
constraints found in production (`zones_code_key` / `zones_code_unique` and
`locations_code_key` / `locations_code_unique`). Removing either pair would be
constraint cleanup and is outside this phase.

Tables, indexes, the two duplicate constraints, and policies use guarded
creation. This allows the baseline to be registered against the existing
production schema without attempting to replace existing objects. A later
production rollout must still review the migration plan before applying or
repairing history; Phase 4 does neither.

## Empty-database verification

Tested with PostgreSQL 17.10 in an isolated local database containing no
production data. The only pre-migration bootstrap was a minimal Supabase
compatibility layer: roles `anon`, `authenticated`, and `service_role`, plus
`auth.users` and `auth.uid()`.

The migrations were applied in filename order with `ON_ERROR_STOP=1`:

1. `20260719000000_phase_0_database_baseline.sql`
2. `20260720220651_phase_1_auth_rls.sql`
3. `20260721171117_phase_2_shopify_sync.sql`
4. `20260721172143_phase_3_inventory_integrity.sql`

All four completed successfully. The baseline was then applied once more
against the completed local schema and completed as a no-op. Catalog
fingerprints before and after that no-op were unchanged.

Final local-versus-production catalog comparison:

| Category | Count | Match |
| --- | ---: | --- |
| Columns | 110 | Exact |
| Constraints | 46 | Exact |
| Indexes | 31 | Exact |
| RLS policies | 19 | Exact |
| Relevant table grants | 164 | Exact |
| RLS table flags | 13 | Exact |
| Functions | 13 | 12 exact; one known text-encoding difference |

The sole function-source difference is pre-existing: production stores the
Phase 2 lease-resume message in `claim_shopify_sync_run` as `kjÃ¸ringen`, while
the UTF-8 migration in the repository correctly produces `kjøringen`. Function
signature, security mode, volatility, configuration, and executable logic are
otherwise the same. The Phase 2 migration was not changed because correcting
that historical message is outside Phase 4.

## Production rollout note

This phase stops at a Draft PR. Before any later production action, confirm
that only the baseline is pending and choose an explicit migration-history
strategy. Do not run the baseline or a migration repair merely on the basis of
the local test documented here.
