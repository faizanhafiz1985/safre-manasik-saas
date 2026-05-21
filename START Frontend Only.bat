@echo off
title Safre Manasik - Frontend Only
color 0E
cls

echo ============================================
echo    SAFRE MANASIK - START FRONTEND ONLY
echo ============================================
echo.

:: ── Project path (edit here if you move the folder) ──────────────────────────
set "PROJECT=C:\Users\fub7209\.claude\projects\Safre Manasik Application"
set "FRONTEND=%PROJECT%\frontend"

:: ── Verify folder ─────────────────────────────────────────────────────────────
if not exist "%FRONTEND%\package.json" (
    echo  ERROR: Cannot find:
    echo  %FRONTEND%\package.json
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
    echo  Then run this file again.
    echo.
    pause
    exit /b 1
)

:: ── Install packages if missing ───────────────────────────────────────────────
echo  [1/3] Checking packages...
if not exist "%FRONTEND%\node_modules" (
    echo         node_modules missing - installing (2-5 minutes)...
    start "Installing Frontend Packages" /D "%FRONTEND%" /WAIT cmd /c "npm install"
    if not exist "%FRONTEND%\node_modules" (
        echo  ERROR: npm install failed. Check internet connection.
        pause
        exit /b 1
    )
    echo         Packages installed OK.
) else (
    echo         Packages already installed.
)
echo.

:: ── Kill anything already on port 3000 ───────────────────────────────────────
echo  [2/3] Clearing port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo         Port 3000 cleared.
echo.

:: ── Start frontend ────────────────────────────────────────────────────────────
echo  [3/3] Opening Frontend window...
echo.
echo  +-------------------------------------------------+
echo  ^|  A YELLOW window will open and compile React.   ^|
echo  ^|  Compilation takes 30 - 90 seconds.             ^|
echo  ^|  Do NOT close that window.                      ^|
echo  +-------------------------------------------------+
echo.

start "Safre Manasik - Frontend [3000]" /D "%FRONTEND%" cmd /k ^
  "color 0E && title [Frontend - Port 3000] && set CI=false && set BROWSER=none && echo. && echo  *** Frontend compiling - please wait (30-90 sec) *** && echo. && npm start"

:: ── Poll until port 3000 is listening (max 3 minutes) ────────────────────────
echo  Waiting for React to compile...
echo  (This window will open the browser automatically when ready)
echo.

set SECS=0
:WAIT
timeout /t 5 /nobreak >nul
set /a SECS+=5

netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% EQU 0 goto READY

echo    [ %SECS%s ]  Still compiling...
if %SECS% GEQ 180 (
    echo.
    echo    Took longer than expected - opening browser anyway.
    echo    Press F5 in the browser if the page looks blank.
    goto OPEN
)
goto WAIT

:READY
echo.
echo  ============================================
echo    FRONTEND IS READY
echo    http://localhost:3000
echo  ============================================
echo.

:OPEN
start "" "http://localhost:3000"
echo  Browser opened at http://localhost:3000
echo.
echo  IMPORTANT: Keep the yellow Frontend window open.
echo  This window can now be closed.
echo.
pause
