# tests/generate-manifest.ps1
# Usage:
#   pwsh -File tests/generate-manifest.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File tests/generate-manifest.ps1 -Dir tests -Out tests/manifest.json
param(
  [string]$Dir = "tests",
  [string]$Out = "tests/manifest.json"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

function To-Posix([string]$p) { return ($p -replace '\\', '/') }

function Walk([string]$dir) {
  $files = @()
  if (Test-Path $dir -PathType Container) {
    Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Name -like "*.test.js") { $files += $_.FullName }
    }
  }
  return $files
}

$testsDir = Join-Path $ProjectRoot $Dir
$outPath  = Join-Path $ProjectRoot $Out

$files = Walk $testsDir

# Normalize to tests/...
$list = @()
foreach ($f in $files) {
  $posix = To-Posix $f
  if ($posix -match "/tests/(.*)$") {
    $list += ("tests/" + $Matches[1])
  } else {
    # fallback relative
    $rel = To-Posix($posix).Substring((To-Posix($ProjectRoot) + "/").Length)
    if ($rel -like "tests/*.test.js" -or $rel -like "tests/*/*.test.js") {
      $list += $rel
    }
  }
}
$list = $list | Sort-Object -Unique

# Ensure out dir
$null = New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outPath)
Set-Content -Path $outPath -Value (ConvertTo-Json $list -Depth 4) -Encoding UTF8

Write-Host ("[manifest] wrote {0} entries to {1}" -f $list.Count, (To-Posix $outPath))
$list | Select-Object -First 10 | ForEach-Object { Write-Host (" - {0}" -f $_) }
