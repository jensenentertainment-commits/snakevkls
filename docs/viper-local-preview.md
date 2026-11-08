# Isolated Viper UI preview

Only `snake-test` (`mvwpbscexvnfavxhbexb`) is permitted. Production `.env.local`,
application sources, Next configuration and deployments remain unchanged.

## One-time operator prerequisite

In an ordinary PowerShell terminal in `C:\Projects\snakevkls`:

```powershell
.\scripts\viper\preview.ps1 -Configure
.\scripts\viper\preview.ps1 -Verify
```

Enter only snake-test's publishable/anon key and secret/service_role key in the
masked prompts. Do not paste keys into chat or command arguments. This is NOT
the PostgreSQL database password. Values are Windows-DPAPI encrypted in
`%LOCALAPPDATA%\SnakeViperPreview\credentials.xml`; the directory is restricted
to the current user, SYSTEM and Administrators. The runner receives decrypted
values through stdin, never command arguments or reports. Missing configuration
stops startup. Existing credential files are never silently replaced.

After successful verification, create the single test login:

```powershell
.\scripts\viper\preview.ps1 -CreateUser
```

Choose a new test-only password of at least 16 characters; retain it separately.
Email: `viper-ui@example.test`. User creation refuses a nonempty auth population.
It does not create the profile or fixtures automatically. If the API response is
lost, inspect the test auth state before any retry; do not reset or duplicate users.

The approved operator then applies `scripts/viper/preview-seed.sql` as one
transaction against the verified test system ID `7702071863184491885`. It refuses
unexpected existing data. No migrations or schema changes are involved. This is
not an automatic consequence of starting the preview. Verify three manual orders,
six lines, two products, two locations, one test zone, 60 total units and the active
admin profile. One order is active with an exception, one ready, one cancelled.
On failure retain state and diagnose; no automatic reset or broad cleanup.

## Start and stop

Stop only the verified previous Snake development server if port 3000 is occupied.
Then:

```powershell
.\scripts\viper\preview.ps1
```

Open `http://localhost:3000/login?next=/viper` in a separate browser profile and
sign in with the test account. All clients and server auth use the same pinned
test project. A visible SNAKE-TEST banner identifies the test copy.

Ctrl+C stops the preview. Ordinary `npm run dev` still uses the original local
configuration (currently production-connected); do not confuse the two commands.
Preview launches a fresh allowlisted source copy under
`%LOCALAPPDATA%\SnakeViperPreview\workspaces\run-*`, without `.env`, prior builds,
scripts or keys. Dependencies are reused through a junction; Webpack dev mode is
used to avoid Turbopack's outside-root symlink restriction. Source changes require
a restart to make a new copy. No dependencies are installed.

Only Viper, login and static resources are reachable. Other modules, AI, cron,
Shopify OAuth/catalog/fulfillment, Viper Shopify import/preview API and unrelated
APIs return 403 in this test copy. No production integrations are inherited.
ROY and Shopify import gates are explicitly false. Server-side authorization,
job ownership and commands are unchanged.

## Scope and acceptance separation

UI fixture identifiers use the `92..99` UUID namespaces, `VUI-*` codes and manual
orders. They do not reuse acceptance fixture IDs. No production data is copied.
Resolve the sample exception to continue the active order; cancellation and
recovery work normally on these synthetic rows. Completion changes test stock.
Shopify source freshness/import cannot be exercised by these manual orders.

This is NOT a separate database within Supabase. The existing acceptance runners
require empty auth/products/orders/inventory and must not run while UI fixtures
are present. Their existing empty-population guards remain unchanged. Ending the
server does not delete data. Before acceptance is resumed, an explicit reviewed
cleanup must remove only the UI-owned records, dependent logs/receipts and test
auth account, then verify the original empty populations. Never truncate/reset
snake-test or disable acceptance safeguards. No cleanup is automatic.

## Current verification boundary

Local runner/guard tests are available. Until the operator supplies test API keys,
the authenticated preflight, user creation, transactional seed and browser login
are NOT executed. Do not call the preview ready based solely on static tests.
