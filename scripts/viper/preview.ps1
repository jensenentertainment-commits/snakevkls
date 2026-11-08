param([switch]$Configure, [switch]$Verify, [switch]$CreateUser)
$ErrorActionPreference = 'Stop'
if (@($Configure,$Verify,$CreateUser | Where-Object { $_ }).Count -gt 1) { throw 'Select one mode' }
$storage = Join-Path $env:LOCALAPPDATA 'SnakeViperPreview'
$credential = Join-Path $storage 'credentials.xml'
if (Test-Path -LiteralPath $storage) {
  if ((Get-Item -LiteralPath $storage).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Storage must not be a link' }
}
if ($Configure) {
  if (Test-Path -LiteralPath $credential) { throw 'Configuration already exists; refusing implicit replacement' }
  New-Item -ItemType Directory -Path $storage -Force | Out-Null
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & icacls.exe $storage /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict storage permissions' }
  Write-Host 'Only snake-test / mvwpbscexvnfavxhbexb. Never enter vk-lager keys.'
  $clientKey = Read-Host 'snake-test publishable or legacy anon key (hidden)' -AsSecureString
  $serverKey = Read-Host 'snake-test secret or legacy service_role key (hidden)' -AsSecureString
  if ($clientKey.Length -eq 0 -or $serverKey.Length -eq 0) { throw 'Empty key; nothing saved' }
  # Export-Clixml encrypts SecureString values with Windows DPAPI for this user.
  [pscustomobject]@{ Project='mvwpbscexvnfavxhbexb'; ClientKey=$clientKey; ServerKey=$serverKey } | Export-Clixml -LiteralPath $credential
  Write-Host 'Encrypted local test keys saved. Next: preview.ps1 -Verify'
  exit
}
if (!(Test-Path -LiteralPath $credential)) { throw 'Test keys missing. Run preview.ps1 -Configure interactively; no server started.' }
if ((Get-Item -LiteralPath $credential).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Credential must not be a link' }
$stored = Import-Clixml -LiteralPath $credential
if ($stored.Project -ne 'mvwpbscexvnfavxhbexb') { throw 'Wrong test project' }
function Unprotect-TestValue([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$payload = @{ project=$stored.Project; url='https://mvwpbscexvnfavxhbexb.supabase.co'; anonKey=(Unprotect-TestValue $stored.ClientKey); serviceKey=(Unprotect-TestValue $stored.ServerKey) }
$mode = if ($Verify) { '--verify' } elseif ($CreateUser) { '--create-user' } else { '--start' }
if ($CreateUser) {
  $password = Read-Host 'New password for viper-ui@example.test; keep separately (16+ characters)' -AsSecureString
  if ($password.Length -lt 16) { throw 'Password too short; no request sent' }
  $payload.password = Unprotect-TestValue $password
}
$info = New-Object Diagnostics.ProcessStartInfo
$info.FileName = (Get-Command node -ErrorAction Stop).Source
$info.Arguments = '"' + (Join-Path $PSScriptRoot 'preview.mjs') + '" ' + $mode
$info.UseShellExecute = $false
$info.RedirectStandardInput = $true
$info.EnvironmentVariables.Clear()
foreach ($name in @('SystemRoot','WINDIR','ComSpec','PATH','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA')) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ($value) { $info.EnvironmentVariables[$name] = $value }
}
$child = [Diagnostics.Process]::Start($info)
try {
  $child.StandardInput.WriteLine(($payload | ConvertTo-Json -Compress))
  $child.StandardInput.Close()
  $payload.Clear()
  $child.WaitForExit()
  exit $child.ExitCode
} finally { $payload.Clear(); $child.Dispose() }
