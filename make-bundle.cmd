@echo off
setlocal
REM make-bundle.cmd (v8b) - preserves folder structure via staging

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%make-bundle.ps1" -OutDir "chatgpt"
echo.
echo (CMD) Finished. Press any key...
pause >nul
