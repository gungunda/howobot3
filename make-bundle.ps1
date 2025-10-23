# make-bundle.ps1 (v10) — robust dir expansion ("dir" and "dir/*"), preserves structure, verbose logs
param(
  [string]$OutDir = "chatgpt",
  [string]$WhitelistFile = "FILES_WHITELIST.txt"
)

# --- Setup
$ScriptDir = (Split-Path -Parent $MyInvocation.MyCommand.Path).TrimEnd('\','/')
Set-Location $ScriptDir

Write-Host "== Howobot3 bundle (v10) ==" -ForegroundColor Cyan
Write-Host ("ScriptDir : {0}" -f $ScriptDir)
Write-Host ("OutDir    : {0}" -f $OutDir)
Write-Host ("Whitelist : {0}" -f $WhitelistFile)
Write-Host ""

# --- Git SHA (optional)
try { $shortSha = (git rev-parse --short HEAD) 2>$null } catch { $shortSha = $null }
if (-not $shortSha) { $shortSha = "no-git" }
$stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "howobot3-$shortSha-$stamp.zip"
$outPath = Join-Path $OutDir $zipName

function To-Rel([string]$abs) {
  $p = (Resolve-Path -LiteralPath $abs).Path
  if ($p.StartsWith($ScriptDir)) {
    return $p.Substring($ScriptDir.Length + 1) -replace '\\','/'
  } else {
    return Split-Path -Leaf $p
  }
}

function Expand-Entry([string]$entryRaw) {
  $result = @()
  $entry = $entryRaw.Trim()
  if (-not $entry) { return $result }
  if ($entry.StartsWith("#")) { return $result }

  # Normalize to backslashes for provider, but keep original for rel paths
  $pathLike = $entry -replace '/','\'
  $full = Join-Path $ScriptDir $pathLike

  # Case 1: exact file
  if (Test-Path $full -PathType Leaf) {
    $result += (To-Rel $full)
    return $result
  }

  # Case 2: exact directory (no wildcard) -> all files recursively
  if (Test-Path $full -PathType Container) {
    $files = Get-ChildItem -Path $full -File -Recurse -ErrorAction SilentlyContinue
    foreach ($f in $files) { $result += (To-Rel $f.FullName) }
    return $result
  }

  # Case 3: "dir/*" -> recursive all files under dir
  if ($entry -match "^(.*)/\*$") {
    $base = $Matches[1] -replace '/','\'
    $baseFull = Join-Path $ScriptDir $base
    if (Test-Path $baseFull -PathType Container) {
      $files = Get-ChildItem -Path $baseFull -File -Recurse -ErrorAction SilentlyContinue
      foreach ($f in $files) { $result += (To-Rel $f.FullName) }
      return $result
    }
  }

  # Case 4: generic wildcard (e.g., *.js) — recursive search from ScriptDir
  if ($entry -like "*`**") {
    $files = Get-ChildItem -Path $ScriptDir -File -Recurse -Filter ($entry -replace '/','\') -ErrorAction SilentlyContinue
    foreach ($f in $files) { $result += (To-Rel $f.FullName) }
    return $result
  }

  return $result
}

# --- Read whitelist and expand
if (-not (Test-Path $WhitelistFile)) {
  Write-Error ("Whitelist not found at: {0}" -f (Join-Path $ScriptDir $WhitelistFile))
  [void][System.Console]::ReadKey($true)
  exit 1
}

$rawEntries = Get-Content -Path $WhitelistFile
$expanded = @()
$unresolved = @()

foreach ($line in $rawEntries) {
  $files = Expand-Entry $line
  if ($files.Count -gt 0) {
    Write-Host ("Entry: {0} -> {1} files" -f $line, $files.Count)
    $expanded += $files
  } else {
    $trim = $line.Trim()
    if ($trim -and -not $trim.StartsWith("#")) {
      Write-Warning ("Unresolved entry: {0}" -f $line)
      $unresolved += $trim
    }
  }
}

$expanded = $expanded | Sort-Object -Unique
Write-Host ("TOTAL resolved files: {0}" -f $expanded.Count) -ForegroundColor Green

# --- Stage to temp and compress
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (Test-Path $outPath) { Remove-Item $outPath -Force }

$tmp = Join-Path $ScriptDir "_bundle_tmp"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

if ($expanded.Count -gt 0) {
  $i = 0
  foreach ($rel in $expanded) {
    $src = Join-Path $ScriptDir ($rel -replace '/','\')
    $dest = Join-Path $tmp ($rel -replace '/','\')
    $destDir = Split-Path -Parent $dest
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item -LiteralPath $src -Destination $dest -Force
    if ($i -lt 20) { Write-Host ("+ staged: {0}" -f $rel) }
    $i++
  }
  if ($expanded.Count -gt 20) {
    Write-Host ("...and {0} more files" -f ($expanded.Count - 20))
  }
  Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $outPath -Force -CompressionLevel Optimal
  Write-Host ("ZIP created: {0}" -f $outPath) -ForegroundColor Green
} else {
  Write-Warning "No files to archive."
}

# --- Cleanup and manifest
if (Test-Path $tmp) { try { Remove-Item $tmp -Recurse -Force } catch {} }

$zipPath = $null
if (Test-Path $outPath) { $zipPath = $outPath }

$manifest = @{
  project   = "howobot3"
  sha       = $shortSha
  createdAt = (Get-Date).ToString("o")
  fileCount = $expanded.Count
  baseDir   = $ScriptDir
  whitelist = $rawEntries
  unresolvedEntries = $unresolved
  zipPath   = $zipPath
  sampleStaged = $expanded[0..([Math]::Min($expanded.Count,20)-1)]
} | ConvertTo-Json -Depth 8

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$manifestPath = Join-Path $OutDir ("manifest-{0}-{1}.json" -f $shortSha, $stamp)
$manifest | Out-File -FilePath $manifestPath -Encoding utf8
Write-Host ("Manifest: {0}" -f $manifestPath)

Write-Host ""
Write-Host "Done. Press any key to exit..."
[void][System.Console]::ReadKey($true)
