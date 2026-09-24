@echo off
rem ============================================================
rem  UniPrep - Stop backend (:3000) + frontend (:5173)
rem ============================================================
echo [UniPrep] Dang dung service...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
exit /b %ERRORLEVEL%
