$Host.UI.RawUI.WindowTitle = 'Cloudflare KV Bulk Deleter by Nijoo'
$scriptDir = Split-Path -Parent $PSCommandPath
$e = [char]27
$R = "$e[0m"
$B = "$e[1m"
$D = "$e[2m"
$O = "$e[38;2;243;128;32m"
$G = "$e[92m"
$C = "$e[96m"
$Y = "$e[93m"
$W = "$e[97m"

$appName = 'Cloudflare KV Bulk Deleter by Nijoo'

function banner {
  Clear-Host
  Write-Host
  Write-Host "$O  +----------------------------------------------------+$R"
  Write-Host "$O  |$R  $B$W     +   CLOUDFLARE KV BULK DELETER   +$R           $O|$R"
  Write-Host "$O  |$R  $D         *  Wipe with style  *$R                    $O|$R"
  Write-Host "$O  +----------------------------------------------------+$R"
  Write-Host
}

# --- launch ---
function runApp {
  Write-Host "$O[*]$R $B`Launching...$R"
  Write-Host
  & "node" "index.mjs"
  Write-Host
  Read-Host '  Press Enter to exit'
  exit 0
}

# --- main ---
banner

# Already installed?
if (Test-Path (Join-Path $scriptDir 'node_modules')) {
  Push-Location $scriptDir
  runApp
  Pop-Location
  exit 0
}

# --- install flow ---
Write-Host "$B$W[*]  Checking environment...$R"
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
  Write-Host
  Write-Host "$R[x]  Node.js is not installed.$R"
  Write-Host
  Write-Host "$Y[v]  Opening download page...$R"
  Start-Process 'https://nodejs.org'
  Write-Host
  Read-Host '  Press Enter after installing Node.js'
  $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $nodePath) {
    Write-Host "$R[x]  Node.js still not found. Exiting.$R"
    Read-Host "`n  Press Enter to exit"
    exit 1
  }
}
$nodeVer = & node --version
Write-Host "$G[+]  Node.js$R $nodeVer"
Write-Host

# --- mode ---
Write-Host "$B$W[*]  Setup mode...$R"
Write-Host
Write-Host "$O  +----------------------------------------------+$R"
Write-Host "$O  |$R  $B[1]$R  Install to folder                         $O|$R"
Write-Host "$O  |$R  $B[2]$R  Portable mode           $D(current dir)$R  $O|$R"
Write-Host "$O  +----------------------------------------------+$R"
Write-Host
$mode = Read-Host "  $C[>]$R Choose [1/2]"
$portable = $mode -ne '1'

$destDir = $scriptDir

if (-not $portable) {
  Write-Host
  Write-Host "$B$W[*]  Select installation folder...$R"
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $fbd = New-Object System.Windows.Forms.FolderBrowserDialog
    $fbd.Description = 'Select install folder for Cloudflare KV Bulk Deleter'
    $fbd.ShowNewFolderButton = $true
    if ($fbd.ShowDialog() -eq 'OK') {
      $destDir = $fbd.SelectedPath
      Write-Host "$G[+]  Destination:$R $destDir"
    } else {
      Write-Host "$Y[!]  No folder selected. Switching to portable.$R"
      $portable = $true
      Start-Sleep -Milliseconds 1000
    }
  } catch {
    Write-Host "$Y[!]  Folder dialog unavailable. Using portable mode.$R"
    $portable = $true
    Start-Sleep -Milliseconds 1000
  }
}
if ($portable) { $destDir = $scriptDir }

# --- copy ---
if (-not $portable) {
  Write-Host
  Write-Host "$B$W[*]  Copying files...$R"
  foreach ($f in @('index.mjs', 'package.json')) {
    $src = Join-Path $scriptDir $f
    $dst = Join-Path $destDir $f
    if (Test-Path $src) {
      Copy-Item -LiteralPath $src -Destination $dst -Force
      Write-Host "$G[+]$R   $f"
    }
  }
  Copy-Item -LiteralPath (Join-Path $scriptDir 'start.ps1') -Destination (Join-Path $destDir 'start.ps1') -Force
  Write-Host
}

# --- npm ---
Write-Host "$B$W[*]  Installing dependencies...$R"
Push-Location $destDir
& "npm.cmd" "install"
if ($LASTEXITCODE -ne 0) {
  Write-Host
  Write-Host "$R[x]  npm install failed.$R"
  Read-Host "`n  Press Enter to exit"
  Pop-Location
  exit 1
}
Pop-Location
Write-Host
Write-Host "$G[+]  Dependencies installed.$R"

# --- done ---
New-Item -Path (Join-Path $destDir 'installed.flag') -ItemType File -Force > $null
Write-Host
Write-Host "$O  +---------------------------------------------+$R"
Write-Host "$O  |$R  $B$G[+]  INSTALLATION COMPLETE$R              $O|$R"
if ($portable) {
  Write-Host "$O  |$R     $D Use start.cmd to launch$R              $O|$R"
} else {
  Write-Host "$O  |$R     $D Installed to:$R                         $O|$R"
  Write-Host "$O  |$R     $C $destDir$R    $O|$R"
  Write-Host "$O  |$R     $D Use desktop shortcut or start.cmd$R     $O|$R"
}
Write-Host "$O  +---------------------------------------------+$R"
Write-Host
Start-Sleep -Milliseconds 1500
Clear-Host

Push-Location $destDir
Write-Host "$B$W[*]  Starting application...$R"
Write-Host
& "node" "index.mjs"
Write-Host
Read-Host '  Press Enter to exit'
Pop-Location
