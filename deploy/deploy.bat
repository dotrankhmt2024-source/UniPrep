@echo off
setlocal
rem ============================================================
rem  UniPrep - Deploy: pull source -> install -> build -> restart
rem  Args: %1 = branch (mac dinh: main)
rem
rem  CO Y khong dung `git reset --hard` / `git clean`:
rem  neu thu muc live co thay doi chua commit, `git pull --ff-only`
rem  se TU CHOI thay vi ghi de -> an toan, khong mat code.
rem ============================================================

set "BRANCH=%~1"
if "%BRANCH%"=="" set "BRANCH=main"
set "ROOT=%~dp0.."

echo ============================================
echo  UniPrep deploy - branch: %BRANCH%
echo  Thu muc: %ROOT%
echo ============================================

echo.
echo [1/5] Dung service dang chay...
call "%~dp0stop.bat" || goto :fail

echo.
echo [2/5] Cap nhat source (fetch / checkout / pull --ff-only)...
cd /d "%ROOT%" || goto :fail
git fetch origin || goto :fail
git checkout "%BRANCH%" || goto :fail
git pull --ff-only origin "%BRANCH%" || goto :fail

echo.
echo [3/5] Backend: npm ci + build...
cd /d "%ROOT%\backend" || goto :fail
call npm ci || goto :fail
call npm run build || goto :fail

echo.
echo [4/5] Frontend: npm ci (Vite dev dung source, khong can build)...
cd /d "%ROOT%\frontend" || goto :fail
call npm ci || goto :fail

echo.
echo [5/5] Khoi dong lai...
call "%~dp0start.bat" || goto :fail

echo.
echo [UniPrep] DEPLOY OK - branch %BRANCH%
exit /b 0

:fail
echo.
echo [UniPrep] DEPLOY FAILED - xem loi phia tren
exit /b 1
