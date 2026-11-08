# Disposable catalog database environment

Provisioned 2026-11-08. Complete isolated fresh and sequential-upgrade acceptance PASSED on 2026-11-08; both targets now contain retained synthetic acceptance state. Do not assume they are empty or automatically reset them.

- Existing native PostgreSQL server/client 17.11, no installation or Docker needed.
- Binaries: `C:\Users\jense\AppData\Local\SnakeViperValidation\tools\pgsql\bin`.
- Dedicated data: `C:\Users\jense\AppData\Local\SnakeCatalogValidation\data`.
- Cluster: `snake_catalog_validation`; system ID `7705827962930311860`.
- Listener: only `127.0.0.1:55433`; manually started, no service registered.
- Owner/test login: `snake_catalog_test`, generated test-only SCRAM password.
- Credential file: restricted workspace `pgpass.conf`; never display or copy its content.
- Databases from template0, UTF8 / C: `snake_phase2a_test_catalogfresh` and
  `snake_phase2a_test_catalogupgrade`. At initial provisioning both were verified with zero application tables
  and no auth/private/phase2a_test schemas.
- Normal durability, constraints and RLS retained. TLS is not configured for
  this loopback-only cluster; this is not the remote Supabase connection policy.

The existing local Phase 2A runner and SQL guard now pin the two exact databases,
matrix, loopback address, port, login, system ID and data directory. Connection
services/host overrides and inline passwords are rejected. Identity is read
before bootstrap. Empty targets remain mandatory. The Viper remote runner and
snake-test are unchanged. No Supabase project was contacted during provisioning.

## Requirements and limits

PostgreSQL 17 supplies the required UUID, JSONB, hashing and concurrency primitives;
the migration chain declares no extension installation requirement. The prepared
bootstrap creates synthetic `auth.users`, `auth.uid()` and the anon/authenticated/
service_role roles (including BYPASSRLS). It requires the dedicated local owner to
create roles and manage fixture backends. This does not test Supabase Auth services,
PostgREST or production infrastructure. Independent sessions and backend termination
are supported by the dedicated cluster. Bootstrap and all 34 migrations have now run on both approved targets.

## Future reruns — separate approval required

Use a new child PowerShell process, not a dot-sourced script:

```powershell
powershell -NoProfile -File scripts/roy-phase2a/local-catalog-acceptance.ps1
```

Default is offline plan only. After separate approval, select `-Matrix fresh` or
`-Matrix upgrade` and explicitly add `-ExecuteApproved`. Retain stdout/stderr in
the restricted recovery workspace. Never reset a failed target automatically.

Historical launcher issue (not a current acceptance blocker): the offline PowerShell launcher probe was rejected by
Windows with `AuthorizationManager check failed`. No execution policy or
Application Control setting was changed or bypassed. Acceptance subsequently ran
directly through Node with the same pinned connection and SQL guards. Complete
fresh and upgrade passed. Evidence: `acceptance-full-fresh-20261108` and
`acceptance-resumed-20261108-1807/upgrade` under the cluster workspace.

The runner discovers the current migration directory. Before acceptance approval,
review and retain the exact manifest, including local Viper migrations and the
SKU identity migrations. Exact hashes and executed results are retained in the
acceptance evidence. Additional concurrent suites/targets require their own pinned
entry points; the old broad database-name pattern is not authorization.

Start/stop only this data directory with the existing `pg_ctl.exe`; do not use
machine-wide PostgreSQL service controls. Keep both databases and credentials
until test evidence has been reviewed. No automatic drop/reset/cleanup is provided.
