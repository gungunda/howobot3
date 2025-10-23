# make-bundle.ps1 (v8b) — preserves folder structure via temp staging; PS5 compatible
param(
  [string]$OutDir = "chatgpt"
)

# Run from script folder
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "== Howobot3 bundle =="
Write-Host ("ScriptDir: {0}" -f $ScriptDir)
Write-Host ("OutDir: {0}" -f $OutDir)
Write-Host ""

# Short SHA (optional)
try { $shortSha = (git rev-parse --short HEAD) 2>$null } catch { $shortSha = $null }
if (-not $shortSha) { $shortSha = "no-git" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "howobot3-$shortSha-$stamp.zip"
$outPath = Join-Path $OutDir $zipName
Write-Host ("Bundle name: {0}" -f $zipName)

# Read whitelist
$whitelistPath = Join-Path $ScriptDir "FILES_WHITELIST.txt"
if (-not (Test-Path $whitelistPath)) {
  Write-Error ("FILES_WHITELIST.txt not found at: {0}" -f $whitelistPath)
  [void][System.Console]::ReadKey($true)
  exit 1
}

# Build list of existing files only (relative paths)
$all = Get-Content -Path $whitelistPath | Where-Object { $_ -and (-not $_.StartsWith("#")) }
$existing = @()
$missing  = @()

foreach ($rel in $all) {
  $full = Join-Path $ScriptDir $rel
  if (Test-Path $full -PathType Leaf) {
    $existing += $rel
  } else {
    $missing  += $rel
  }
}

if ($missing.Count -gt 0) {
  Write-Warning "Skipping missing files:"
  foreach ($m in $missing) { Write-Host ("  - {0}" -f $m) }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (Test-Path $outPath) { Remove-Item $outPath -Force }

# Prepare temp staging folder to preserve directory structure
$tmp = Join-Path $ScriptDir "_bundle_tmp"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

if ($existing.Count -eq 0) {
  Write-Warning "No files to archive."
} else {
  foreach ($rel in $existing) {
    $src  = Join-Path $ScriptDir $rel
    $dest = Join-Path $tmp $rel
    $destDir = Split-Path -Parent $dest
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item -LiteralPath $src -Destination $dest -Force
    Write-Host ("+ staged: {0}" -f $rel)
  }

  # Now compress the staged folder preserving its internal subfolders
  try {
    Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $outPath -Force -CompressionLevel Optimal
    Write-Host ("ZIP created: {0}" -f $outPath)
  } catch {
    Write-Error ("Compress-Archive failed: {0}" -f $_.Exception.Message)
    [void][System.Console]::ReadKey($true)
    exit 1
  }
}

# Cleanup temp staging
if (Test-Path $tmp) {
  try { Remove-Item $tmp -Recurse -Force } catch {}
}

# Manifest
$zipPath = $null
if (Test-Path $outPath) { $zipPath = $outPath }

$manifest = @{
  project   = "howobot3"
  sha       = $shortSha
  createdAt = (Get-Date).ToString("o")
  fileCount = $existing.Count
  baseDir   = $ScriptDir
  skipped   = $missing
  zipPath   = $zipPath
} | ConvertTo-Json -Depth 6

$manifestPath = Join-Path $OutDir ("manifest-{0}-{1}.json" -f $shortSha, $stamp)
$manifest | Out-File -FilePath $manifestPath -Encoding utf8
Write-Host ("Manifest: {0}" -f $manifestPath)

Write-Host ""
Write-Host "Done. Press any key to exit..."
[void][System.Console]::ReadKey($true)
