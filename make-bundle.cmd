@echo off
setlocal
REM make-bundle.cmd (v10) - robust expansion of directories and patterns

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%make-bundle.ps1" -OutDir "chatgpt" -WhitelistFile "FILES_WHITELIST.txt"
echo.
echo (CMD) Finished. Press any key...
pause >nul
