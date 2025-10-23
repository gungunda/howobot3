@echo off
setlocal
REM generate-manifest.cmd — кликни, чтобы обновить tests/manifest.json

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo == Generating tests/manifest.json ==
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%generate-manifest.ps1"

echo.
echo Done. Manifest updated.
echo.
pause