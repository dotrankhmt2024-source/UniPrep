@echo off
rem ============================================================
rem  UniPrep - Start backend + frontend + ensure tunnel (detached)
rem  Args: /silent  (giu cho tuong thich convention)
rem ============================================================
echo [UniPrep] Dang khoi dong backend :3000 + frontend :5173...
wscript //B "%~dp0start.vbs" /silent
echo [UniPrep] Da gui lenh start (xem deploy\start.log).
exit /b 0
