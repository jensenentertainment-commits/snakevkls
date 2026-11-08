param([switch]$Configure)
$ErrorActionPreference = 'Stop'
$storage = Join-Path $env:LOCALAPPDATA 'SnakeViperShopifyReadTest'
$credential = Join-Path $storage 'credentials.xml'
if ((Test-Path -LiteralPath $storage) -and ((Get-Item -LiteralPath $storage).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Storage must not be a link' }
if ($Configure) {
  if (Test-Path -LiteralPath $credential) { throw 'Test credential already exists; refusing overwrite' }
  $clientId = Read-Host 'Viper Read Test Client ID (not a production app)'
  $secret = Read-Host 'Viper Read Test Client secret (hidden)' -AsSecureString
  if ($clientId -notmatch '^[a-fA-F0-9]{32}$' -or $secret.Length -eq 0) { throw 'Invalid input; nothing saved' }
  New-Item -ItemType Directory -Path $storage -Force | Out-Null
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true,$false)
  foreach ($identity in @($sid, (New-Object Security.Principal.SecurityIdentifier 'S-1-5-18'), (New-Object Security.Principal.SecurityIdentifier 'S-1-5-32-544'))) {
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $storage -AclObject $acl
  [pscustomobject]@{Shop='jensendigita.myshopify.com'; ShopId='gid://shopify/Shop/76635341052'; ClientId=$clientId; Secret=$secret} | Export-Clixml -LiteralPath $credential
  Write-Host 'Test credential saved with Windows DPAPI. No API request performed.'
  exit
}
if (!(Test-Path -LiteralPath $credential)) { throw 'Run -Configure interactively first' }
if ((Get-Item -LiteralPath $credential).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Credential must not be a link' }
$stored = Import-Clixml -LiteralPath $credential
if ($stored.Shop -ne 'jensendigita.myshopify.com' -or $stored.ShopId -ne 'gid://shopify/Shop/76635341052') { throw 'Wrong test identity' }
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($stored.Secret)
try { $payload = @{shop=$stored.Shop;shopId=$stored.ShopId;clientId=$stored.ClientId;clientSecret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)} }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
$info = New-Object Diagnostics.ProcessStartInfo
$info.FileName = (Get-Command node -ErrorAction Stop).Source
$info.Arguments = '"' + (Join-Path $PSScriptRoot 'shopify-read-test.mjs') + '"'
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
  $child.StandardInput.Close(); $payload.Clear(); $child.WaitForExit()
  exit $child.ExitCode
} finally { $payload.Clear(); $child.Dispose() }
