:: make-plain.cmd
:: Запускает make-plain.ps1 для генерации текстовой простыни проекта.

@echo off
setlocal

REM Определяем путь к этому .cmd (т.е. корень репозитория)
set SCRIPT_DIR=%~dp0

REM Включаем исполнение PowerShell-скриптов локально (только для этой сессии)
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%make-plain.ps1"

endlocal
