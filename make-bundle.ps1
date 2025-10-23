# make-bundle.ps1 — собирает архив chatgpt/howobot3-<shortsha>-<date>.zip
param(
  [string]$OutDir = "chatgpt"
)

# --- 1) Подготовка имён
$shortSha = (git rev-parse --short HEAD) 2>$null
if (-not $shortSha) { $shortSha = "no-git" }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "howobot3-$shortSha-$stamp.zip"
$outPath = Join-Path $OutDir $zipName

# --- 2) Читаем whitelist
if (-not (Test-Path "FILES_WHITELIST.txt")) {
  Write-Error "FILES_WHITELIST.txt не найден в корне проекта."
  exit 1
}
$files = Get-Content -Path "FILES_WHITELIST.txt" | Where-Object { $_ -and (-not $_.StartsWith("#")) }

# --- 3) Проверка отсутствующих файлов (не фейлим сборку)
$missing = @()
foreach ($f in $files) {
  if (-not (Test-Path $f)) { $missing += $f }
}
if ($missing.Count -gt 0) {
  Write-Warning "Некоторые файлы отсутствуют:`n$($missing -join "`n")"
}

# --- 4) Упаковка
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (Test-Path $outPath) { Remove-Item $outPath -Force }
Compress-Archive -Path $files -DestinationPath $outPath -Force

# --- 5) Манифест
$manifest = @{
  project   = "howobot3"
  sha       = $shortSha
  createdAt = (Get-Date).ToString("o")
  fileCount = $files.Count
} | ConvertTo-Json -Depth 4
$manifestPath = Join-Path $OutDir "manifest-$shortSha-$stamp.json"
$manifest | Out-File -FilePath $manifestPath -Encoding utf8

Write-Host "OK: $outPath"
Write-Host "Manifest: $manifestPath"
