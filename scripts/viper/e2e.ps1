param([switch]$Verify,[switch]$StartApproved,[switch]$ResumeApproved)
$ErrorActionPreference='Stop'
if (@($Verify,$StartApproved,$ResumeApproved | Where-Object {$_}).Count -ne 1) { throw 'Select exactly one approved mode: -Verify, -StartApproved or -ResumeApproved.' }
function Load-TestCredential([string]$folder) {
  $dir=Join-Path $env:LOCALAPPDATA $folder
  $file=Join-Path $dir 'credentials.xml'
  foreach($p in @($dir,$file)) {
    if(!(Test-Path -LiteralPath $p) -or ((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint)) {throw 'Missing or linked test credentials'}
  }
  return Import-Clixml -LiteralPath $file
}
function Unprotect-TestValue([Security.SecureString]$value) {
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try{return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}
$db=Load-TestCredential 'SnakeViperPreview'
$shop=Load-TestCredential 'SnakeViperShopifyReadTest'
if($db.Project -ne 'mvwpbscexvnfavxhbexb' -or $shop.Shop -ne 'jensendigita.myshopify.com' -or $shop.ShopId -ne 'gid://shopify/Shop/76635341052') {throw 'Wrong test identity'}
$payload=@{
 database=@{project=$db.Project;url='https://mvwpbscexvnfavxhbexb.supabase.co';anonKey=(Unprotect-TestValue $db.ClientKey);serviceKey=(Unprotect-TestValue $db.ServerKey)}
 shopify=@{shop=$shop.Shop;shopId=$shop.ShopId;clientId=$shop.ClientId;clientSecret=(Unprotect-TestValue $shop.Secret)}
}
$info=New-Object Diagnostics.ProcessStartInfo
$info.FileName=(Get-Command node -ErrorAction Stop).Source
$mode=if($Verify){'--verify'}elseif($ResumeApproved){'--resume-approved'}else{'--start-approved'}
$info.Arguments='"'+(Join-Path $PSScriptRoot 'e2e.mjs')+'" '+$mode
$info.UseShellExecute=$false
$info.RedirectStandardInput=$true
$info.EnvironmentVariables.Clear()
foreach($name in @('SystemRoot','WINDIR','ComSpec','PATH','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA')) {
 $value=[Environment]::GetEnvironmentVariable($name);if($value){$info.EnvironmentVariables[$name]=$value}
}
$child=[Diagnostics.Process]::Start($info)
try{$child.StandardInput.WriteLine(($payload|ConvertTo-Json -Depth 5 -Compress));$child.StandardInput.Close();$payload.Clear();$child.WaitForExit();exit $child.ExitCode}
finally{$payload.Clear();$child.Dispose()}
