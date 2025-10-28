@echo off
REM send_button.cmd
REM Запускает send_button.ps1
powershell -ExecutionPolicy Bypass -File "%~dp0send_button.ps1"
echo.
echo Done.
pause
