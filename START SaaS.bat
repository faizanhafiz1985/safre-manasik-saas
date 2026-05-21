@echo off
title Safre Manasik SaaS - Startup
color 0A
cls

echo ============================================
echo    SAFRE MANASIK - SaaS PLATFORM
echo    Multi-tenant edition v2.0
echo ============================================
echo.

set "PROJECT=C:\Users\fub7209\.claude\projects\Safre Manasik Application"
set "BACKEND=%PROJECT%\backend"
set "FRONTEND=%PROJECT%\frontend"

:: Kill anything currently on 5000 and 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do taskkill /PID %%a /F >nul 2>&1
timeout /t 2 /nobreak >nul

:: PostgreSQL check
powershell -NoProfile -Command "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('localhost',5432);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  PostgreSQL not running. Starting service...
    for %%V in (17 16 15 14) do (
        sc.exe start "postgresql-x64-%%V" >nul 2>&1
    )
    timeout /t 8 /nobreak >nul
)
echo  [OK] PostgreSQL ready on 5432
echo.

:: Start backend
echo  Starting Backend (port 5000)...
start "Safre SaaS - Backend [5000]" /D "%BACKEND%" cmd /k ^
  "color 0B && title [SaaS Backend] && node src\server.js"

:: Wait for backend
set /a TRY=0
:WAIT
timeout /t 3 /nobreak >nul
set /a TRY+=1
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% EQU 0 goto BE_OK
if %TRY% GEQ 10 ( echo  Backend timeout. Check Backend window. & pause & exit /b 1 )
goto WAIT

:BE_OK
echo  [OK] Backend listening on 5000
echo.

:: Start frontend
echo  Starting Frontend (port 3000)...
start "Safre SaaS - Frontend [3000]" /D "%FRONTEND%" cmd /k ^
  "color 0E && title [SaaS Frontend] && set BROWSER=none && npm start"

echo  [OK] Frontend window opened. Compiling...
echo.
echo ============================================
echo    READY at  http://localhost:3000
echo ============================================
echo.
echo   LOGIN CREDENTIALS
echo   -----------------------------------------
echo   Super Admin (sees ALL tenants):
echo     superadmin@safremanasik.com / Super@2026!
echo.
echo   Tenant: alrashidi (ACTIVE)
echo     admin@alrashidi.sa       / Admin@1234
echo     agent1@alrashidi.local   / Agent@1234
echo     abdullah@alrashidi.local / Customer@1234
echo.
echo   Tenant: hamdan-tours (TRIAL)
echo     admin@hamdan-tours.com   / Admin@1234
echo.
echo ============================================
echo.
timeout /t 10 /nobreak >nul
start "" "http://localhost:3000"
pause
