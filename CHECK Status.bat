@echo off
title Safre Manasik - Status Check
color 0B
cls

echo ============================================
echo    SAFRE MANASIK - SERVICE STATUS CHECK
echo ============================================
echo.

:: --- PostgreSQL (port 5432) ---
netstat -ano | findstr ":5432 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% EQU 0 (
    echo   [ UP   ]  PostgreSQL Database   ^|  port 5432
) else (
    echo   [ DOWN ]  PostgreSQL Database   ^|  port 5432
)

:: --- Backend (port 5000) ---
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% EQU 0 (
    echo   [ UP   ]  Backend API           ^|  port 5000
) else (
    echo   [ DOWN ]  Backend API           ^|  port 5000
)

:: --- Frontend (port 3000) ---
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% EQU 0 (
    echo   [ UP   ]  Frontend Web App      ^|  port 3000
) else (
    echo   [ DOWN ]  Frontend Web App      ^|  port 3000
)

echo.
echo ============================================
echo.

:: --- Try a real HTTP request to the login API to verify backend is healthy ---
echo Testing Backend API health...
powershell -NoProfile -Command "try{$r=Invoke-WebRequest -Uri 'http://localhost:5000/api/auth/login' -Method POST -Body '{}' -ContentType 'application/json' -UseBasicParsing -ErrorAction Stop; Write-Host '  Backend API responding (HTTP' $r.StatusCode ')'} catch { if ($_.Exception.Response.StatusCode.value__ -gt 0) { Write-Host '  Backend API responding (HTTP' $_.Exception.Response.StatusCode.value__ ')' } else { Write-Host '  Backend API NOT responding' } }"

echo.
echo Testing Frontend...
powershell -NoProfile -Command "try{$r=Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -ErrorAction Stop; Write-Host '  Frontend responding (HTTP' $r.StatusCode ')'} catch { Write-Host '  Frontend NOT responding' }"

echo.
echo ============================================
echo.
pause
