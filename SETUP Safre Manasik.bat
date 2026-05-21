@echo off
title Safre Manasik - First Time Setup
color 0B
cls

echo ============================================
echo    SAFRE MANASIK - FIRST TIME SETUP
echo ============================================
echo.
echo  This will install all required dependencies.
echo  Run this ONCE before starting the application.
echo.
echo  Requirements:
echo    - Node.js 18+ must be installed
echo    - PostgreSQL 16 must be installed and running
echo    - npm must be available in PATH
echo.
pause

set PROJECT_DIR=%~dp0

:: ── Step 1: Install Backend Dependencies ─────────────────────────────────────
echo.
echo [1/3] Installing Backend dependencies...
echo      (This may take 2-3 minutes)
cd /d "%PROJECT_DIR%backend"
call npm install
if %errorlevel% NEQ 0 (
    echo.
    echo  ERROR: Backend npm install failed.
    echo  Make sure Node.js is installed: https://nodejs.org
    pause
    exit /b 1
)
echo      Backend dependencies installed.

:: ── Step 2: Install Frontend Dependencies ────────────────────────────────────
echo.
echo [2/3] Installing Frontend dependencies...
echo      (This may take 3-5 minutes)
cd /d "%PROJECT_DIR%frontend"
call npm install
if %errorlevel% NEQ 0 (
    echo.
    echo  ERROR: Frontend npm install failed.
    pause
    exit /b 1
)
echo      Frontend dependencies installed.

:: ── Step 3: Initialize Database ──────────────────────────────────────────────
echo.
echo [3/3] Setting up database schema...
cd /d "%PROJECT_DIR%backend"
call npx prisma db push
if %errorlevel% NEQ 0 (
    echo.
    echo  WARNING: Database push failed.
    echo  Check your .env file for the correct DATABASE_URL.
    echo  Make sure PostgreSQL is running.
    pause
)
echo      Database schema applied.

echo.
echo ============================================
echo   SETUP COMPLETE!
echo ============================================
echo.
echo   You can now run:  START Safre Manasik.bat
echo.
echo   Default Admin Login:
echo     Email   : admin@safremanasik.com
echo     Password: Admin@1234
echo.
pause
