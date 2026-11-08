param(
  [ValidateSet('fresh','upgrade')][string]$Matrix = 'fresh',
  [switch]$ExecuteApproved
)
$ErrorActionPreference = 'Stop'
# Run as a child PowerShell process. No .env, Supabase credentials or global PATH.
if (-not $ExecuteApproved) {
  Write-Output 'Plan only. No database connection. Separate acceptance approval required.'
  exit 0
}
$bin = 'C:\Users\jense\AppData\Local\SnakeViperValidation\tools\pgsql\bin'
$passfile = 'C:\Users\jense\AppData\Local\SnakeCatalogValidation\pgpass.conf'
if (!(Test-Path -LiteralPath "$bin\psql.exe") -or !(Test-Path -LiteralPath $passfile)) {
  throw 'Approved local tooling or credential file unavailable'
}
Get-ChildItem Env:PG* | ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) }
$env:PATH = $bin + ';' + $env:PATH
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '55433'
$env:PGUSER = 'snake_catalog_test'
$env:PGDATABASE = 'snake_phase2a_test_catalog' + $Matrix
$env:PGPASSFILE = $passfile
# SCRAM on loopback only; this configuration can never target a remote host.
$env:PGSSLMODE = 'disable'
Push-Location (Join-Path $PSScriptRoot '../..')
try {
  & node scripts/roy-phase2a/database-acceptance.mjs --execute --matrix $Matrix --database $env:PGDATABASE --confirm "EXECUTE ISOLATED $Matrix $($env:PGDATABASE)"
  if ($LASTEXITCODE -ne 0) { throw 'Acceptance failed; preserve target and diagnostics. Do not reset automatically.' }
} finally { Pop-Location }
