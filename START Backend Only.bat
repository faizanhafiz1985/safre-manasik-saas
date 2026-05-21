@echo off
title Safre Manasik - Backend Only
color 0B
cls

echo ============================================
echo    SAFRE MANASIK - START BACKEND ONLY
echo ============================================
echo.

:: ── Project path (edit here if you move the folder) ──────────────────────────
set "PROJECT=C:\Users\fub7209\.claude\projects\Safre Manasik Application"
set "BACKEND=%PROJECT%\backend"

:: ── Verify folder ─────────────────────────────────────────────────────────────
if not exist "%BACKEND%\src\server.js" (
    echo  ERROR: Cannot find:
    echo  %BACKEND%\src\server.js
    echo.
    echo  Make sure the PROJECT= path in this file is correct.
    echo.
    pause
    exit /b 1
)

:: ── Verify Node.js ────────────────────────────────────────────────────────────
node -v >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  ERROR: Node.js not found.
    echo  Download and install it from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: ── Check PostgreSQL is up first ─────────────────────────────────────────────
echo  [1/3] Checking PostgreSQL (port 5432)...
powershell -NoProfile -Command ^
  "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('localhost',5432);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% NEQ 0 (
    echo.
    echo  WARNING: PostgreSQL does not appear to be running on port 5432.
    echo  The backend will fail to start without a database connection.
    echo.
    echo  Start PostgreSQL first, then press any key to continue,
    echo  or close this window to cancel.
    pause
)
echo         PostgreSQL check done.
echo.

:: ── Install packages if missing ───────────────────────────────────────────────
echo  [2/3] Checking packages...
if not exist "%BACKEND%\node_modules" (
    echo         node_modules missing - installing...
    start "Installing Backend Packages" /D "%BACKEND%" /WAIT cmd /c "npm install"
    echo         Packages installed.
) else (
    echo         Packages already installed.
)
echo.

:: ── Kill anything already on port 5000 ───────────────────────────────────────
echo  [3/3] Starting Backend (port 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

start "Safre Manasik - Backend [5000]" /D "%BACKEND%" cmd /k ^
  "color 0B && title [Backend - Port 5000] && echo. && echo  *** Backend starting... *** && echo. && node src\server.js"

:: ── Poll up to 30s for port 5000 ─────────────────────────────────────────────
set /a TRY=0
:BPOLL
timeout /t 3 /nobreak >nul
set /a TRY+=1
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% EQU 0 goto BOK
if %TRY% GEQ 10 (
    echo.
    echo  Backend has not responded within 30 seconds.
    echo  Check the CYAN window for error messages.
    echo  Common causes:
    echo    - PostgreSQL not running
    echo    - .env file missing or wrong DATABASE_URL
    echo.
    pause
    exit /b 1
)
echo    [ %TRY%0s ]  Waiting for backend...
goto BPOLL

:BOK
echo.
echo  ============================================
echo    BACKEND IS READY  >>  port 5000
echo  ============================================
echo.
echo  Keep the CYAN Backend window open.
echo  This window can now be closed.
echo.
pause
