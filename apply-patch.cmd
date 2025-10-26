@echo off
REM apply-patch.cmd
REM This will apply "patch.txt" from the project root using apply-patch.ps1

powershell -ExecutionPolicy Bypass -File "%~dp0apply-patch.ps1" -PatchFile "patch.txt"
echo.
echo Patch applied.
pause
