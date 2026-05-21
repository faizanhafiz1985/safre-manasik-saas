@echo off
title Safre Manasik - Shutdown
color 0C
cls

echo ============================================
echo    SAFRE MANASIK - STOPPING ALL SERVICES
echo ============================================
echo.

:: ── Stop Frontend (port 3000) ─────────────────────────────────────────────────
echo [1/3] Stopping Frontend (port 3000)...
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
    set FOUND=1
)
if "%FOUND%"=="1" (echo      Frontend stopped.) else (echo      Frontend was not running.)

:: ── Stop Backend (port 5000) ──────────────────────────────────────────────────
echo.
echo [2/3] Stopping Backend API (port 5000)...
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
    set FOUND=1
)
if "%FOUND%"=="1" (echo      Backend stopped.) else (echo      Backend was not running.)

:: ── Kill any remaining node processes for this project ────────────────────────
echo.
echo [3/3] Cleaning up node processes...
taskkill /FI "WINDOWTITLE eq Safre Manasik*" /F >nul 2>&1
echo      Cleanup done.

echo.
echo ============================================
echo   All Safre Manasik services stopped.
echo   PostgreSQL service kept running (shared).
echo ============================================
echo.
echo   To start again, double-click:
echo   "START Safre Manasik.bat"
echo.
pause
