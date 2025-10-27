@echo off
REM make-plain.cmd
REM Запускает make-plain.ps1 и генерит partialbundle_YYYYMMDD_HHmmss.txt

powershell -ExecutionPolicy Bypass -File "%~dp0make-plain-partial.ps1"
echo.
echo Bundle generated.
pause
