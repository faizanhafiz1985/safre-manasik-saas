@echo off
title Safre Manasik - Startup
color 0A
cls

echo ============================================
echo    SAFRE MANASIK TRAVEL MANAGEMENT SYSTEM
echo ============================================
echo.

:: ── Paths (edit PROJECT= if you move the folder) ─────────────────────────────
set "PROJECT=C:\Users\fub7209\.claude\projects\Safre Manasik Application"
set "BACKEND=%PROJECT%\backend"
set "FRONTEND=%PROJECT%\frontend"

:: ── Verify folder structure ───────────────────────────────────────────────────
if not exist "%BACKEND%\src\server.js" (
    echo  ERROR: Cannot find backend\src\server.js
    echo  Make sure this file is inside the "Safre Manasik Application" folder.
    echo.
    pause & exit /b 1
)
if not exist "%FRONTEND%\package.json" (
    echo  ERROR: Cannot find frontend\package.json
    pause & exit /b 1
)

:: ── Verify Node.js ────────────────────────────────────────────────────────────
node -v >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  ERROR: Node.js not found. Install from https://nodejs.org
    pause & exit /b 1
)

:: ══════════════════════════════════════════════════════════════════════════════
:: STEP 1 — PostgreSQL
:: ══════════════════════════════════════════════════════════════════════════════
echo [STEP 1/4]  PostgreSQL
echo.

:: Is it already listening on 5432?
powershell -NoProfile -Command ^
  "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('localhost',5432);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% EQU 0 (
    echo  PostgreSQL already running on port 5432.
    goto PG_OK
)

echo  PostgreSQL not detected - attempting to start...

:: Try sc.exe for versions 14-17
for %%V in (17 16 15 14) do (
    sc.exe query "postgresql-x64-%%V" >nul 2>&1
    if not errorlevel 1 (
        sc.exe start "postgresql-x64-%%V" >nul 2>&1
        echo  Started service: postgresql-x64-%%V
        goto PG_WAIT
    )
)

:: Fallback: net start
for %%V in (17 16 15 14) do (
    net start "postgresql-x64-%%V" >nul 2>&1
    if not errorlevel 1 (
        echo  Started via net start: postgresql-x64-%%V
        goto PG_WAIT
    )
)

:: Last resort: re-launch as admin
echo  Needs Administrator rights - re-launching elevated...
powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs" >nul 2>&1
if %errorlevel% EQU 0 exit /b 0

:: All attempts failed
echo.
echo  =============================================
echo   CANNOT START POSTGRESQL AUTOMATICALLY
echo  =============================================
echo   Please start it manually:
echo    1. Press Win+R, type services.msc, press Enter
echo    2. Find "postgresql-x64-16" (or 17/15/14)
echo    3. Right-click  ^>  Start
echo    4. Then run this batch file again.
echo  =============================================
echo.
pause & exit /b 1

:PG_WAIT
echo  Waiting for PostgreSQL to accept connections...
set /a PG_TRY=0
:PG_POLL
timeout /t 4 /nobreak >nul
set /a PG_TRY+=1
powershell -NoProfile -Command ^
  "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('localhost',5432);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% EQU 0 goto PG_OK
if %PG_TRY% GEQ 8 (
    echo  ERROR: PostgreSQL started but port 5432 not responding after 32s.
    echo  Wait 30 seconds and try again.
    pause & exit /b 1
)
echo  Still waiting... (%PG_TRY%/8)
goto PG_POLL

:PG_OK
echo  PostgreSQL OK - port 5432 is accepting connections.
echo.

:: ══════════════════════════════════════════════════════════════════════════════
:: STEP 2 — Backend packages
:: ══════════════════════════════════════════════════════════════════════════════
echo [STEP 2/4]  Checking packages
echo.

if not exist "%BACKEND%\node_modules" (
    echo  Backend packages missing - installing (please wait)...
    start "Installing Backend Packages" /D "%BACKEND%" /WAIT cmd /c "npm install"
    echo  Backend install complete.
)
if not exist "%FRONTEND%\node_modules" (
    echo  Frontend packages missing - installing (2-5 minutes)...
    start "Installing Frontend Packages" /D "%FRONTEND%" /WAIT cmd /c "npm install"
    echo  Frontend install complete.
)
echo  Packages OK.
echo.

:: ══════════════════════════════════════════════════════════════════════════════
:: STEP 3 — Backend
:: ══════════════════════════════════════════════════════════════════════════════
echo [STEP 3/4]  Starting Backend (port 5000)
echo.

:: Kill anything already on 5000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

start "Safre Manasik - Backend [5000]" /D "%BACKEND%" cmd /k ^
  "color 0B && title [Backend - Port 5000] && echo. && echo  Backend starting... && echo. && node src\server.js"

:: Wait until backend is actually listening
set /a BE_TRY=0
:BE_POLL
timeout /t 3 /nobreak >nul
set /a BE_TRY+=1
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% EQU 0 goto BE_OK
if %BE_TRY% GEQ 10 (
    echo  WARNING: Backend did not start within 30s.
    echo  Check the cyan window for errors, then continue.
    echo.
    pause
    goto BE_OK
)
echo  Waiting for backend... (%BE_TRY%/10)
goto BE_POLL

:BE_OK
echo  Backend OK - port 5000 is listening.
echo.

:: ══════════════════════════════════════════════════════════════════════════════
:: STEP 4 — Frontend
:: ══════════════════════════════════════════════════════════════════════════════
echo [STEP 4/4]  Starting Frontend (port 3000)
echo.

:: Kill anything already on 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

start "Safre Manasik - Frontend [3000]" /D "%FRONTEND%" cmd /k ^
  "color 0E && title [Frontend - Port 3000] && set CI=false && set BROWSER=none && echo. && echo  Frontend compiling (30-90 seconds)... && echo. && npm start"

echo  Frontend window opened. Compiling in background...
echo.
echo  Do NOT close this window, the cyan Backend window,
echo  or the yellow Frontend window.
echo.

:: Poll until port 3000 is listening (max 3 min)
set SECS=0
:FE_POLL
timeout /t 6 /nobreak >nul
set /a SECS+=6
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% EQU 0 goto APP_READY
echo  Still compiling... %SECS%s elapsed
if %SECS% GEQ 180 (
    echo  Opening browser now - press F5 if page looks blank.
    goto APP_READY
)
goto FE_POLL

:APP_READY
echo.
echo ============================================
echo    APP IS READY  >>  http://localhost:3000
echo ============================================
echo.
echo   Admin    : admin@safremanasik.com  ^|  Admin@1234
echo   Agent    : ahmed@alrashidi.sa      ^|  Agent@1234
echo   Customer : abdullah@email.com      ^|  Customer@1234
echo.
echo   Keep Backend and Frontend windows open.
echo   This window can be closed.
echo.
start "" "http://localhost:3000"
pause
