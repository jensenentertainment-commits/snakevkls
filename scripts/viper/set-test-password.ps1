# Operator-only interactive credential setup. No database connection or SQL.
param([switch]$Console, [switch]$Replace)
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\jense\AppData\Local\SnakeViperValidation\supabase-test'
$credentialPath = Join-Path $root 'pgpass.conf'
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
New-Item -ItemType Directory -Path $root -Force | Out-Null
& icacls.exe $root /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict credential directory' }
if ((Get-Item -LiteralPath $root).Attributes -band [IO.FileAttributes]::ReparsePoint) {
  throw 'Credential directory cannot be a link'
}
if ((Test-Path -LiteralPath $credentialPath) -and -not $Replace) {
  throw 'Credential file already exists. Use -Replace to replace the snake-test password explicitly.'
}

function Save-TestCredential([string]$Value) {
  $temporary = Join-Path $root ('credential-' + [Guid]::NewGuid().ToString('N') + '.tmp')
  try {
    $exists = Test-Path -LiteralPath $credentialPath
    if ($exists) {
      if (-not $Replace) { throw 'Replacement not requested' }
      if ((Get-Item -LiteralPath $credentialPath).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Credential file cannot be a link'
      }
      $originalAcl = Get-Acl -LiteralPath $credentialPath
    }
    # Create beside the destination under the restricted directory ACL.
    # Apply existing file permissions before writing any secret bytes.
    $stream = [IO.File]::Open($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $stream.Dispose()
    if ($exists) { Set-Acl -LiteralPath $temporary -AclObject $originalAcl }
    [IO.File]::WriteAllText($temporary,$Value,(New-Object Text.UTF8Encoding($false)))
    if ($exists) {
      # Atomic replacement; no delete-first and no backup containing the old secret.
      # Metadata errors are not ignored: failure must leave the original intact.
      [IO.File]::Replace($temporary,$credentialPath,[System.Management.Automation.Language.NullString]::Value)
    } else {
      [IO.File]::Move($temporary,$credentialPath)
    }
  } catch {
    throw 'Could not save the test credential safely. No database connection was made.'
  } finally {
    $Value=$null
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
  }
}

if ($Console) {
  Write-Host 'TEST ONLY: snake-test / mvwpbscexvnfavxhbexb'
  Write-Host 'Password input is masked; no database connection will be made.'
  $first = $null; $second = $null
  $firstPtr = [IntPtr]::Zero; $secondPtr = [IntPtr]::Zero
  try {
    $first = Read-Host 'Database password' -AsSecureString
    $second = Read-Host 'Repeat database password' -AsSecureString
    $firstPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
    $secondPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
    $firstText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPtr)
    $secondText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPtr)
    if ([string]::IsNullOrEmpty($firstText) -or $firstText -cne $secondText -or $firstText -match '[\r\n]') {
      throw 'Passwords must be non-empty and identical; nothing saved'
    }
    $escaped = $firstText.Replace('\','\\').Replace(':','\:')
    $record = 'aws-0-eu-west-1.pooler.supabase.com:5432:postgres:postgres.mvwpbscexvnfavxhbexb:' + $escaped + "`n"
    Save-TestCredential $record
    [IO.File]::WriteAllText((Join-Path $root 'credential-ready.txt'),'Test credential saved for mvwpbscexvnfavxhbexb; contents must not be logged.')
    Write-Host 'Test password saved. No database connection made.'
  } finally {
    if ($firstPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPtr) }
    if ($secondPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPtr) }
    if ($first) { $first.Dispose() }; if ($second) { $second.Dispose() }
    $firstText=$null; $secondText=$null; $escaped=$null; $record=$null
  }
  return
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object Windows.Forms.Form
$form.Text = 'Snake TEST - database password'
$form.Size = New-Object Drawing.Size(580,270)
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$label = New-Object Windows.Forms.Label
$label.Text = "Only snake-test / mvwpbscexvnfavxhbexb`r`naws-0-eu-west-1.pooler.supabase.com:5432`r`nEnter the TEST database password. Stored locally with restricted access."
$label.Location = New-Object Drawing.Point(15,15)
$label.Size = New-Object Drawing.Size(540,65)
$password = New-Object Windows.Forms.TextBox
$password.UseSystemPasswordChar = $true
$password.Location = New-Object Drawing.Point(15,85)
$password.Width = 530
$label2 = New-Object Windows.Forms.Label
$label2.Text = 'Repeat password'
$label2.Location = New-Object Drawing.Point(15,115)
$label2.Width = 530
$repeat = New-Object Windows.Forms.TextBox
$repeat.UseSystemPasswordChar = $true
$repeat.Location = New-Object Drawing.Point(15,140)
$repeat.Width = 530
$save = New-Object Windows.Forms.Button
$save.Text = 'Save test password'
$save.Location = New-Object Drawing.Point(15,180)
$save.Width = 180
$save.Add_Click({
  if ([string]::IsNullOrEmpty($password.Text) -or $password.Text -cne $repeat.Text -or $password.Text -match '[\r\n]') {
    [Windows.Forms.MessageBox]::Show('Passwords must be non-empty and identical.') | Out-Null
    return
  }
  $form.DialogResult = [Windows.Forms.DialogResult]::OK
  $form.Close()
})
$form.Controls.AddRange(@($label,$password,$label2,$repeat,$save))
$form.AcceptButton = $save
try {
  if ($form.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { return }
  $escaped = $password.Text.Replace('\','\\').Replace(':','\:')
  $record = 'aws-0-eu-west-1.pooler.supabase.com:5432:postgres:postgres.mvwpbscexvnfavxhbexb:' + $escaped + "`n"
  Save-TestCredential $record
  [IO.File]::WriteAllText((Join-Path $root 'credential-ready.txt'),'Test credential saved for mvwpbscexvnfavxhbexb; contents must not be logged.')
} finally {
  $password.Clear(); $repeat.Clear(); $escaped=$null; $record=$null
  $form.Dispose()
}
