# Windows version of install.sh: installs nozikov's usage-limits mod with our
# rounded-corner patch, plus windows.patch (PowerShell helpers, since Windows has
# no sh). Run from this repository: pwsh personal-sync/usage-limits/install.ps1
$ErrorActionPreference = 'Stop'

$syncDir = $PSScriptRoot
$appDir = Join-Path $HOME '.config/herdr-app'
$revision = '048dbe911ee957f42d465d950a5ce04d61fed904'

foreach ($tool in 'git', 'herdr-app') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Required command not found: $tool" }
}

# These are the mod references in layout.template, except usage-limits itself.
foreach ($mod in 'islands-workspace-chrome', 'islands-spaces', 'islands-agents', 'islands-tabs', 'islands-pane', 'islands-workspace-status', 'files', 'changes') {
  if (-not (Test-Path (Join-Path $appDir "mods/$mod/main.js"))) { throw "Install Islands first. Missing mod: $mod" }
}

# Native commands don't stop the script on failure, so check each one.
function Invoke-Checked([string]$Exe, [string[]]$Arguments) {
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Exe $($Arguments -join ' ') failed with exit $LASTEXITCODE" }
}

$tempDir = Join-Path ([IO.Path]::GetTempPath()) "herdr-usage-sync.$([guid]::NewGuid().ToString('N').Substring(0, 8))"
New-Item -ItemType Directory $tempDir | Out-Null
try {
  $repoDir = Join-Path $tempDir 'upstream'
  # LF endings, so the patches apply.
  Invoke-Checked git @('-c', 'core.autocrlf=false', 'clone', 'https://github.com/nozikov/herdr-usage-limits.git', $repoDir)
  Invoke-Checked git @('-C', $repoDir, '-c', 'core.autocrlf=false', 'checkout', '--detach', $revision)
  # A Windows checkout can give the patches CRLF endings. The mod's files are LF.
  foreach ($name in 'rounded-corners.patch', 'windows.patch') {
    $patch = Join-Path $tempDir $name
    [IO.File]::WriteAllText($patch, ([IO.File]::ReadAllText((Join-Path $syncDir $name)) -replace "`r`n", "`n"))
    Invoke-Checked git @('-C', $repoDir, 'apply', $patch)
  }
  Copy-Item (Join-Path $repoDir 'LICENSE') (Join-Path $repoDir 'mods/usage-limits/LICENSE')
  Invoke-Checked herdr-app @('check', (Join-Path $repoDir 'mods/usage-limits'))

  $destination = Join-Path $appDir 'mods/usage-limits'
  $layoutPath = Join-Path $appDir 'layouts/islands-usage-limits.json'
  $backupRoot = Join-Path $appDir 'backups/usage-limits'
  New-Item -ItemType Directory -Force $backupRoot, (Join-Path $appDir 'mods'), (Join-Path $appDir 'layouts') | Out-Null
  $backupDir = Join-Path $backupRoot "install.$([guid]::NewGuid().ToString('N').Substring(0, 8))"
  New-Item -ItemType Directory $backupDir | Out-Null
  if (Test-Path $destination) {
    if ((Get-Item $destination -Force).LinkType) { throw "Refusing to replace a link: $destination" }
    Copy-Item -Recurse $destination (Join-Path $backupDir 'mod')
  }
  if (Test-Path $layoutPath) { Copy-Item $layoutPath (Join-Path $backupDir 'layout.json') }
  New-Item -ItemType Directory -Force $destination | Out-Null
  Copy-Item -Recurse -Force (Join-Path $repoDir 'mods/usage-limits/*') $destination
  Copy-Item -Force (Join-Path $syncDir 'layout.template') $layoutPath
  Invoke-Checked herdr-app @('check', $destination)
  Invoke-Checked herdr-app @('do', 'layout.switch', '{"name":"islands"}')
  Invoke-Checked herdr-app @('do', 'layout.switch', '{"name":"islands-usage-limits"}')
  Write-Output "Installed usage limits. Backup: $backupDir"
} finally {
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}
